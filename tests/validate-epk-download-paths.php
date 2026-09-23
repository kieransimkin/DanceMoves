<?php
declare(strict_types=1);

define('ABSPATH', __DIR__);

function add_action(...$args): void {}
function add_filter(...$args): void {}
function wp_get_upload_dir(): array {
    return array(
        'baseurl' => 'https://kieransimkin.co.uk/wp-content/uploads',
        'basedir' => __DIR__ . '/uploads',
        'error' => false,
    );
}
function wp_parse_url($url) { return parse_url($url); }
function wp_salt($scheme = 'auth'): string { return 'test-only-dance-moves-salt'; }
function home_url($path = ''): string { return 'https://kieransimkin.co.uk' . $path; }
function add_query_arg(array $args, string $url): string { return $url . '?' . http_build_query($args, '', '&', PHP_QUERY_RFC3986); }

$repo = dirname(__DIR__);
require $repo . '/kieran-epk-device-orientation.php';

$valid = '2026/08/Track Name.mp3';
$download_url = dance_moves_epk_download_url($valid);
$query = array();
parse_str((string) parse_url($download_url, PHP_URL_QUERY), $query);

$checks = array(
    'normal_relative_path' => $valid === dance_moves_epk_download_normalize_relative_path($valid),
    'encoded_relative_path' => $valid === dance_moves_epk_download_normalize_relative_path('2026%2F08%2FTrack%20Name.mp3'),
    'uppercase_extension' => '2026/08/Track.MP3' === dance_moves_epk_download_normalize_relative_path('2026/08/Track.MP3'),
    'traversal_rejected' => '' === dance_moves_epk_download_normalize_relative_path('2026/08/../secret.mp3'),
    'encoded_traversal_rejected' => '' === dance_moves_epk_download_normalize_relative_path('2026/08/%2e%2e/secret.mp3'),
    'non_mp3_rejected' => '' === dance_moves_epk_download_normalize_relative_path('2026/08/cover.jpg'),
    'external_url_rejected' => '' === dance_moves_epk_download_relative_path_from_url('https://example.com/wp-content/uploads/2026/08/Track.mp3'),
    'sibling_path_rejected' => '' === dance_moves_epk_download_relative_path_from_url('https://kieransimkin.co.uk/wp-content/plugins/Track.mp3'),
    'same_upload_url_accepted' => $valid === dance_moves_epk_download_relative_path_from_url('https://kieransimkin.co.uk/wp-content/uploads/2026/08/Track%20Name.mp3'),
    'root_relative_upload_url_accepted' => $valid === dance_moves_epk_download_relative_path_from_url('/wp-content/uploads/2026/08/Track%20Name.mp3'),
    'signed_url_contains_path' => ($query[DANCE_MOVES_DOWNLOAD_QUERY_VAR] ?? '') === $valid,
    'signed_url_signature_valid' => isset($query[DANCE_MOVES_DOWNLOAD_SIGNATURE_QUERY_VAR]) && hash_equals(
        dance_moves_epk_download_signature($valid),
        $query[DANCE_MOVES_DOWNLOAD_SIGNATURE_QUERY_VAR]
    ),
);

foreach ($checks as $name => $passed) {
    printf("%s=%s\n", $name, $passed ? 'PASS' : 'FAIL');
}
exit(in_array(false, $checks, true) ? 1 : 0);
