<?php
/** Exercise the real PHP adapter without a WordPress database. This is not a WordPress HTTP test. */
declare(strict_types=1);
define('ABSPATH', __DIR__);
$page_id = 4000; $page = true; $ambient = ''; $scripts = []; $styles = []; $localized = []; $checks = 0;
function add_action(...$args): void {}
function add_filter(...$args): void {}
function absint($value): int {return abs((int)$value);}
function sanitize_key($value): string {return preg_replace('/[^a-z0-9_\-]/','',strtolower((string)$value));}
function esc_url_raw($value): string {return (string)$value;}
function wp_get_attachment_url($id): string {return '';}
function get_queried_object_id(): int {global $page_id;return $page_id;}
function is_page($id=0): bool {global $page;return $page;}
function get_post_meta($id,$key,$single=true) {global $ambient;return match($key) {'_dance_moves_bpm'=>145,'_dance_moves_effect'=>$ambient,default=>''};}
function plugin_dir_url($file): string {return 'https://example.test/wp-content/plugins/kieran-epk-device-orientation/';}
function wp_enqueue_style($name,$src,$deps=[],$version=false): void {global $styles;$styles[$name]=compact('src','deps','version');}
function wp_enqueue_script($name,$src=false,$deps=[],$version=false,$footer=false): void {global $scripts;$scripts[$name]=compact('src','deps','version','footer');}
function wp_localize_script($handle,$name,$data): void {global $localized;$localized[$name]=$data;}
function wp_enqueue_media(): void {}
function get_current_screen(): object {return (object)['post_type'=>'page'];}
function check($value,string $label): void {global $checks;if(!$value){fwrite(STDERR,"FAIL $label\n");exit(1);}++$checks;}
require dirname(__DIR__,2).'/kieran-epk-device-orientation.php';
function run_page(): void {global $scripts,$styles,$localized;$scripts=$styles=$localized=[];ks_epk_orientation_enqueue_runtime();dance_moves_enqueue_rudiments();}
function one_runtime(): void {global $scripts; $real=array_filter($scripts,fn($s)=>false!==$s['src']);check(count($real)===1,'exactly one frontend JS artifact');check(str_ends_with($real['dance-moves-core']['src'],'/lib/wordpress.js'),'shared library entry is used');foreach($scripts as $handle=>$s)if($handle!=='dance-moves-core')check(false===$s['src'],'aliases do not duplicate engines');}
run_page();one_runtime();check(145.0===$localized['danceMovesConfig']['bpm'],'page metadata BPM');check(false===$localized['danceMovesConfig']['clayEnabled'],'Clay default disabled');
$ambient='paper-planes';run_page();one_runtime();check(isset($scripts['dance-moves-paper-dreams']),'paper dependency alias');check(str_contains($localized['danceMovesConfig']['atlasUrl'],'/lib/assets/'),'shared atlas URL');
$ambient='';$page_id=252;run_page();one_runtime();check(true===$localized['danceMovesConfig']['clayEnabled'],'Clay opt in');check('clay-stars'===$localized['danceMovesConfig']['orientationAdapter'],'orientation metadata');check(!isset($styles['dance-moves-clay-rudiments']),'rudiment styling remains consumer-owned');
$page_id=839;run_page();one_runtime();check('california-screamin'===$localized['danceMovesConfig']['orientationAdapter'],'California adapter selection');
$page_id=1359;run_page();one_runtime();check('a-whole-new-christmas'===$localized['danceMovesConfig']['orientationAdapter'],'A Whole New Christmas adapter selection');check(8===$localized['danceMovesConfig']['sharedControlTicks'],'A Whole New Christmas shared control timing');
$page_id=252;define('KS_CLAY_STARS_EFFECTS_VERSION','legacy');run_page();one_runtime();check(false===$localized['danceMovesConfig']['clayEnabled'],'legacy plugin suppresses shared Clay');check(!isset($styles['dance-moves-clay-rudiments']),'no plugin-owned Clay rudiment style');
$page=false;run_page();check(!$scripts&&!$styles,'non-page context unchanged');
$scripts=[];dance_moves_admin_assets('post.php');check(str_ends_with($scripts['dance-moves-admin']['src'],'/lib/admin.min.js'),'admin imports shared build');
echo "PASS WordPress shared-library queue contracts ($checks checks)\n";
