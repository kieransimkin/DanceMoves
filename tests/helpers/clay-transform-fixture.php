<?php
declare(strict_types=1);

// CLI-only WordPress test context. The production filter is required by each test,
// never reimplemented here. PHP assert() is deliberately not used by this helper.
if (PHP_SAPI !== 'cli') {
    throw new RuntimeException('Clay transform fixtures must only run from the CLI.');
}
define('ABSPATH', dirname(__DIR__));

$dm_clay_context = array();
$dm_clay_checks = array();
$dm_clay_filters = array();

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});
set_exception_handler(static function (Throwable $error): void {
    fwrite(STDERR, 'Clay/Stars validation error: ' . $error->getMessage() . "\n");
    exit(2);
});

function dm_clay_context(array $overrides = array()): void {
    $GLOBALS['dm_clay_context'] = array_replace(array(
        'page_id' => 252, 'admin' => false, 'in_loop' => true, 'main_query' => true,
    ), $overrides);
}
function is_page($id = 0): bool { return (int) $id === $GLOBALS['dm_clay_context']['page_id']; }
function is_admin(): bool { return $GLOBALS['dm_clay_context']['admin']; }
function in_the_loop(): bool { return $GLOBALS['dm_clay_context']['in_loop']; }
function is_main_query(): bool { return $GLOBALS['dm_clay_context']['main_query']; }
function add_action(...$args): void {}
function add_filter(...$args): void { $GLOBALS['dm_clay_filters'][] = $args; }

dm_clay_context();

function dm_clay_read_text(string $path): string {
    // Explicit local paths only: no remote fetch or traversal up a release tree.
    if (strpos($path, '://') !== false || !is_file($path) || !is_readable($path)) {
        throw new RuntimeException('Required local HTML/fixture file is missing or unreadable: ' . $path);
    }
    $size = filesize($path);
    if ($size === false || $size > 1048576) {
        throw new RuntimeException('Fixture exceeds 1 MiB: ' . $path);
    }
    $text = file_get_contents($path);
    if (!is_string($text) || !preg_match('//u', $text) || strpos($text, "\0") !== false || strpos($text, "\xEF\xBF\xBD") !== false) {
        throw new RuntimeException('Fixture must be strict UTF-8 without null/replacement bytes: ' . $path);
    }
    return $text;
}

function dm_clay_fixture(string $name): string {
    if (!in_array($name, array('base.html', 'expected.html'), true)) {
        throw new InvalidArgumentException('Unknown Clay fixture: ' . $name);
    }
    $directory = dirname(__DIR__) . '/fixtures/clay-transform';
    $manifest = json_decode(dm_clay_read_text($directory . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
    $expected = $manifest['files'][$name] ?? null;
    if (($manifest['schema'] ?? '') !== 'dance-moves-clay-transform-fixtures/v1' ||
        ($manifest['scope'] ?? '') !== 'synthetic-unit-only' ||
        !is_string($expected) || !preg_match('/^[a-f0-9]{64}$/D', $expected)) {
        throw new RuntimeException('Invalid Clay fixture manifest. Restore the checked-in fixtures.');
    }
    // Accommodate Windows checkout line endings, but never trim, strip a BOM,
    // replace Unicode, or accept a newly computed expectation automatically.
    $text = str_replace("\r\n", "\n", dm_clay_read_text($directory . '/' . $name));
    if (!hash_equals($expected, hash('sha256', $text))) {
        throw new RuntimeException('Clay fixture hash mismatch: ' . $name . '; restore or review the fixture, do not bypass this check.');
    }
    return $text;
}

function dm_clay_check(string $name, bool $passed): void {
    $GLOBALS['dm_clay_checks'][$name] = $passed;
    printf("%s=%s\n", $name, $passed ? 'PASS' : 'FAIL');
}

function dm_clay_finish(string $label): void {
    $failed = in_array(false, $GLOBALS['dm_clay_checks'], true);
    printf("%s: %s (%d checks).\n", $label, $failed ? 'FAIL' : 'PASS', count($GLOBALS['dm_clay_checks']));
    exit($failed ? 1 : 0);
}
