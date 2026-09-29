<?php
/** Copy into a CHILD theme's functions.php (without a duplicate opening PHP tag).
 * Create a draft Page with slug arcadians-demo and the markup below.
 * Put arcadians-example.js and arcadians-example.css beside functions.php.
 */
add_action('wp_enqueue_scripts', function () {
    if (!is_page('arcadians-demo')) { return; }
    $directory = get_stylesheet_directory();
    wp_enqueue_style('my-arcadians-example', get_stylesheet_directory_uri() . '/arcadians-example.css', array('dance-moves-core'), (string) filemtime($directory . '/arcadians-example.css'));
    wp_enqueue_script('my-arcadians-example', get_stylesheet_directory_uri() . '/arcadians-example.js', array('dance-moves-core', 'dance-moves-effects', 'dance-moves-rudiments'), (string) filemtime($directory . '/arcadians-example.js'), true);
}, 40);
