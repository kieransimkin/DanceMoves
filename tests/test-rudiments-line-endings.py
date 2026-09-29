#!/usr/bin/env python3
"""Exercise the native builder's pinned-text handling without compiling anything."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rudiments_builder', ROOT / 'tools/build-rudiments.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


class PinnedSources(unittest.TestCase):
    def setUp(self):
        self.data = b'alpha\nbeta\n'
        self.expected = blob(self.data)

    def test_exact_lf(self):
        self.assertEqual(builder.pinned_text_bytes(self.data, self.expected, 'test'), self.data)

    def test_crlf_only(self):
        self.assertEqual(builder.pinned_text_bytes(self.data.replace(b'\n', b'\r\n'), self.expected, 'test'), self.data)

    def test_mixed_lf_crlf(self):
        self.assertEqual(builder.pinned_text_bytes(b'alpha\r\nbeta\n', self.expected, 'test'), self.data)

    def test_exact_crlf_pin_is_not_rewritten(self):
        data = b'alpha\r\nbeta\r\n'
        self.assertEqual(builder.pinned_text_bytes(data, blob(data), 'test'), data)

    def test_every_real_pinned_file(self):
        pin = json.loads((ROOT / 'vendor/dancerudiments/UPSTREAM.json').read_text('utf-8'))
        for name, expected in pin['files'].items():
            with self.subTest(file=name):
                data = (ROOT / 'vendor/dancerudiments' / name).read_bytes().replace(b'\r\n', b'\n')
                self.assertEqual(blob(data), expected)
                for candidate in (data, data.replace(b'\n', b'\r\n')):
                    self.assertEqual(builder.pinned_text_bytes(candidate, expected, name), data)

    def test_header_crlf_uses_distinct_blob(self):
        name = 'include/dancerudiments/dance_rudiments.hpp'
        pin = json.loads((ROOT / 'vendor/dancerudiments/UPSTREAM.json').read_text('utf-8'))
        data = (ROOT / 'vendor/dancerudiments' / name).read_bytes().replace(b'\r\n', b'\n')
        self.assertEqual(blob(data), pin['files'][name])
        self.assertNotEqual(blob(data.replace(b'\n', b'\r\n')), pin['files'][name])

    def test_significant_byte_changes_rejected(self):
        candidates = {
            'changed code': b'Alpha\r\nbeta\r\n',
            'BOM': b'\xef\xbb\xbf' + self.data,
            'lone CR': b'alpha\rbeta\n',
            'doubled CR': b'alpha\r\r\nbeta\n',
            'trailing space': b'alpha \r\nbeta\r\n',
            'missing final LF': b'alpha\r\nbeta',
            'extra final LF': self.data + b'\n',
            'null': self.data + b'\0',
            'invalid utf8': self.data + b'\xff',
            'empty': b'',
        }
        for label, data in candidates.items():
            with self.subTest(case=label):
                with self.assertRaisesRegex(ValueError, 'integrity mismatch'):
                    builder.pinned_text_bytes(data, self.expected, label)

    def test_invalid_pins_rejected(self):
        for expected in (None, '', 'x' * 40, 'a' * 39, 'a' * 41, 'A' * 40):
            with self.subTest(pin=expected):
                with self.assertRaisesRegex(ValueError, 'malformed'):
                    builder.pinned_text_bytes(self.data, expected, 'test')

    def test_no_source_writes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'source.hpp'
            data = self.data.replace(b'\n', b'\r\n')
            path.write_bytes(data)
            builder.pinned_text_bytes(path.read_bytes(), self.expected, str(path))
            self.assertEqual(path.read_bytes(), data)

    def test_output_uses_bytes_not_platform_text_writer(self):
        # Detect newline translation even when this test itself runs on Linux.
        class ByteOnlyPath:
            def write_bytes(self, value):
                self.value = value
        path = ByteOnlyPath()
        builder.write_utf8(path, 'alpha\nbeta\n\u00e9\n')
        self.assertEqual(path.value, b'alpha\nbeta\n\xc3\xa9\n')
        self.assertNotIn(b'\r', path.value)

    def test_real_output_exact_utf8_lf(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / 'generated.js'
            builder.write_utf8(path, 'one\ntwo\n')
            self.assertEqual(path.read_bytes(), b'one\ntwo\n')


if __name__ == '__main__':
    unittest.main(verbosity=2)
