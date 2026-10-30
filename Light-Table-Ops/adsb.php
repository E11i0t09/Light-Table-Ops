<?php
// Bridge Ops ADS-B proxy · © 2026 E11iot · CC BY-NC-ND 4.0 · https://creativecommons.org/licenses/by-nc-nd/4.0/
/*
 * ADS-B-Proxy für die Wallpaper "Bridge Ops"
 *
 *  adsb.php?lat=..&lon=..&dist=..            -> Flugzeuge im Umkreis (Seemeilen), 8 s Cache
 *  adsb.php?info=1&hex=..&cs=..&plat=..&plon=.. -> Halter/Typ (hexdb.io) + Route (adsb.lol, Fallback hexdb.io)
 *  adsb.php?dwd=en&ags=<Kreis-AGS>                 -> DWD-Warnungen auf Englisch (CAP), 5 min Cache
 *  adsb.php?trail=3c6444                       -> mitgeschriebene Flugbahn (bis 2 h), Positionen aus den Abfragen oben
 *  adsb.php?metar=EDDH,EKCH                    -> METAR/TAF (MET Norway, Rückfall aviationweather.gov), 5 min Cache
 *
 * Quellen: airplanes.live (Fallback adsb.lol), hexdb.io, MET Norway, aviationweather.gov. Nur private, nicht-kommerzielle Nutzung.
 * Läuft ab PHP 5.4 (ZipArchive für die englischen DWD-Warnungen).
 */
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$UA = 'BridgeOps-Wallpaper/1.3 (private; +https://' . (isset($_SERVER['HTTP_HOST']) ? preg_replace('/[^A-Za-z0-9.\-]/', '', $_SERVER['HTTP_HOST']) : 'localhost') . ')';
$cacheDir = __DIR__ . '/adsb-cache';
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755);

function http_get($url, $post = null) {
  global $UA;
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, $UA);
    curl_setopt($ch, CURLOPT_ENCODING, '');
    if ($post !== null) {
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
      curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
    }
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($code >= 200 && $code < 300) ? $body : false;
  }
  $opts = array('timeout' => 6, 'user_agent' => $UA, 'ignore_errors' => false);
  if ($post !== null) { $opts['method'] = 'POST'; $opts['header'] = "Content-Type: application/json\r\n"; $opts['content'] = $post; }
  return @file_get_contents($url, false, stream_context_create(array('http' => $opts)));
}
function cache_get($file, $maxAge) { return (is_file($file) && time() - filemtime($file) < $maxAge) ? file_get_contents($file) : false; }
function cache_put($file, $data) { @file_put_contents($file, $data, LOCK_EX); }

/* ================= DWD-Warnungen auf Englisch (CAP, opendata.dwd.de) ================= */
if (isset($_GET['dwd'])) {
  $ags = preg_replace('/[^0-9]/', '', isset($_GET['ags']) ? $_GET['ags'] : '');
  $file = "$cacheDir/dwd_en_$ags.json";
  $hit = cache_get($file, 300);
  if ($hit !== false) { echo $hit; exit; }
  $out = array('warnings' => array(), 'src' => 'opendata.dwd.de');
  $dir = 'https://opendata.dwd.de/weather/alerts/cap/COMMUNEUNION_DWD_STAT/';
  $list = http_get($dir);
  if ($list && preg_match_all('/Z_CAP_C_EDZW_(\d{14})_PVW_STATUS_PREMIUMDWD_COMMUNEUNION_EN\.zip/', $list, $m)) {
    $latest = max($m[1]);
    $zipData = http_get($dir . "Z_CAP_C_EDZW_{$latest}_PVW_STATUS_PREMIUMDWD_COMMUNEUNION_EN.zip");
    if ($zipData && class_exists('ZipArchive')) {
      $tmp = "$cacheDir/dwd_en.zip";
      file_put_contents($tmp, $zipData);
      $zip = new ZipArchive();
      if ($zip->open($tmp) === true) {
        $seen = array();
        for ($i = 0; $i < $zip->numFiles; $i++) {
          $xml = @simplexml_load_string($zip->getFromIndex($i));
          if (!$xml) continue;
          $xml->registerXPathNamespace('c', 'urn:oasis:names:tc:emergency:cap:1.2');
          $mt = $xml->xpath('//c:msgType');
          if ($mt && (string)$mt[0] === 'Cancel') continue;
          foreach ($xml->xpath('//c:info') as $info) {
            $info->registerXPathNamespace('c', 'urn:oasis:names:tc:emergency:cap:1.2');
            $cells = array(); $inArea = false;
            foreach ($info->xpath('.//c:area/c:geocode') as $gc) {
              $gc->registerXPathNamespace('c', 'urn:oasis:names:tc:emergency:cap:1.2');
              $vn = $gc->xpath('c:valueName'); $vv = $gc->xpath('c:value');
              if ($vn && $vv && (string)$vn[0] === 'WARNCELLID') { $id = (string)$vv[0]; $cells[] = $id; if (substr($id, 1, strlen($ags)) === $ags) $inArea = true; }
            }
            $g = function($n) use ($info) { $r = $info->xpath("c:$n"); return $r ? trim((string)$r[0]) : ''; };
            $w = array('event' => $g('event'), 'severity' => $g('severity'), 'onset' => $g('onset'), 'expires' => $g('expires'),
                       'headline' => $g('headline'), 'description' => $g('description'), 'instruction' => $g('instruction'), 'inArea' => $inArea);
            $key = $w['event'] . '|' . $w['onset'] . '|' . $w['expires'] . '|' . ($inArea ? 1 : 0);
            if (isset($seen[$key])) continue; $seen[$key] = 1;
            $out['warnings'][] = $w;
          }
        }
        $zip->close();
      }
      @unlink($tmp);
      // Warnungen im Kreis zuerst, Rest nur als Rückfallebene
      usort($out['warnings'], function($a, $b) { return $b['inArea'] - $a['inArea']; });
      $out['warnings'] = array_slice($out['warnings'], 0, 300);
    } else if (!class_exists('ZipArchive')) {
      $out['error'] = 'ZipArchive fehlt auf dem Server';
    }
  }
  $json = json_encode($out);
  cache_put($file, $json);
  echo $json;
  exit;
}

/* ================= Flugbahn (selbst mitgeschrieben, max. 2 h) ================= */
$trailDir = "$cacheDir/trail";
define('TRAIL_AGE', 7200);
function trail_record($list) {
  global $trailDir;
  if (!is_dir($trailDir)) @mkdir($trailDir, 0755);
  $t = time();
  foreach ($list as $a) {
    if (!isset($a['hex'], $a['lat'], $a['lon'])) continue;
    $hex = strtolower(preg_replace('/[^0-9a-fA-F~]/', '', $a['hex']));
    if ($hex === '' || strlen($hex) > 7) continue;
    $alt = isset($a['alt_baro']) && is_numeric($a['alt_baro']) ? (int)$a['alt_baro'] : (isset($a['alt_geom']) && is_numeric($a['alt_geom']) ? (int)$a['alt_geom'] : 0);
    @file_put_contents("$trailDir/$hex.txt", $t . ',' . round($a['lat'], 5) . ',' . round($a['lon'], 5) . ',' . $alt . "\n", FILE_APPEND | LOCK_EX);
  }
  // alle 5 min aufräumen: alte Dateien löschen, große kürzen
  $mark = "$trailDir/.clean";
  if (!is_file($mark) || $t - filemtime($mark) > 300) {
    @touch($mark);
    foreach ((array)glob("$trailDir/*.txt") as $f) {
      if ($t - filemtime($f) > TRAIL_AGE) { @unlink($f); continue; }
      if (filesize($f) > 24000) {
        $keep = array();
        foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) { if ((int)$l > $t - TRAIL_AGE) $keep[] = $l; }
        @file_put_contents($f, $keep ? implode("\n", $keep) . "\n" : '', LOCK_EX);
      }
    }
  }
}
if (isset($_GET['trail'])) {
  $hex = strtolower(preg_replace('/[^0-9a-fA-F~]/', '', $_GET['trail']));
  $out = array('hex' => $hex, 'trail' => array());
  $f = "$trailDir/$hex.txt";
  if ($hex !== '' && strlen($hex) <= 7 && is_file($f)) {
    $t = time(); $last = 0;
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) {
      $p = explode(',', $l);
      if (count($p) < 4 || (int)$p[0] <= $t - TRAIL_AGE || (int)$p[0] === $last) continue;
      $last = (int)$p[0];
      $out['trail'][] = array((int)$p[0], (float)$p[1], (float)$p[2], (int)$p[3]);
    }
    $out['trail'] = array_slice($out['trail'], -1500);
  }
  echo json_encode($out);
  exit;
}

/* ================= METAR / TAF ================= */
if (isset($_GET['metar'])) {
  $codes = array();
  foreach (explode(',', strtoupper($_GET['metar'])) as $c) { if (preg_match('/^[A-Z]{4}$/', $c)) $codes[] = $c; }
  $codes = array_slice(array_unique($codes), 0, 16);
  if (!$codes) { http_response_code(400); echo '{"error":"bad icao"}'; exit; }
  sort($codes); $q = implode(',', $codes);
  $file = "$cacheDir/metar_" . md5($q) . '.json';
  $hit = cache_get($file, 300);
  if ($hit !== false) { echo $hit; exit; }
  $out = array('src' => '', 'metar' => array(), 'taf' => array());
  // 1. MET Norway (Text: eine Meldung je Zeile, älteste zuerst)
  $m = http_get("https://api.met.no/weatherapi/tafmetar/1.0/metar.txt?icao=$q");
  if ($m !== false && trim($m) !== '') {
    $t = http_get("https://api.met.no/weatherapi/tafmetar/1.0/taf.txt?icao=$q");
    $split = function($txt) { $r = array(); foreach (explode('=', (string)$txt) as $l) { $l = trim(preg_replace('/\s+/', ' ', $l)); if ($l !== '') $r[] = $l; } return $r; };
    $out = array('src' => 'metno', 'metar' => $split($m), 'taf' => $split($t));
  } else {
    // 2. aviationweather.gov (NOAA)
    $mj = json_decode(http_get("https://aviationweather.gov/api/data/metar?ids=$q&format=json&hours=3"), true);
    $tj = json_decode(http_get("https://aviationweather.gov/api/data/taf?ids=$q&format=json"), true);
    if (is_array($mj)) {
      $ms = array(); $ts = array();
      foreach (array_reverse($mj) as $o) { if (isset($o['rawOb'])) $ms[] = trim(preg_replace('/\s+/', ' ', $o['rawOb'])); }
      if (is_array($tj)) foreach (array_reverse($tj) as $o) { if (isset($o['rawTAF'])) $ts[] = trim(preg_replace('/\s+/', ' ', $o['rawTAF'])); }
      $out = array('src' => 'awc', 'metar' => $ms, 'taf' => $ts);
    }
  }
  if ($out['src'] === '') { if (is_file($file)) { readfile($file); exit; } http_response_code(502); echo '{"error":"upstream","metar":[],"taf":[]}'; exit; }
  $json = json_encode($out);
  cache_put($file, $json);
  echo $json;
  exit;
}

/* ================= Zusatzinfos zu einem Flugzeug ================= */
if (isset($_GET['info'])) {
  $hex = strtolower(preg_replace('/[^0-9a-fA-F]/', '', isset($_GET['hex']) ? $_GET['hex'] : ''));
  $cs  = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', isset($_GET['cs']) ? $_GET['cs'] : ''));
  $plat = isset($_GET['plat']) ? (float)$_GET['plat'] : 0;
  $plon = isset($_GET['plon']) ? (float)$_GET['plon'] : 0;
  if (strlen($hex) !== 6) { http_response_code(400); echo '{"error":"bad hex"}'; exit; }

  // Halter / Typ – 7 Tage Cache
  $acFile = "$cacheDir/ac_$hex.json";
  $ac = cache_get($acFile, 7 * 86400);
  if ($ac === false) {
    $j = json_decode(http_get("https://hexdb.io/api/v1/aircraft/$hex"), true);
    $ac = json_encode(is_array($j) && isset($j['ModeS']) ? array(
      'reg' => isset($j['Registration']) ? $j['Registration'] : '',
      'manufacturer' => isset($j['Manufacturer']) ? $j['Manufacturer'] : '',
      'type' => isset($j['Type']) ? $j['Type'] : '',
      'icaoType' => isset($j['ICAOTypeCode']) ? $j['ICAOTypeCode'] : '',
      'owner' => isset($j['RegisteredOwners']) ? $j['RegisteredOwners'] : '',
      'operator' => isset($j['OperatorFlagCode']) ? $j['OperatorFlagCode'] : '',
    ) : new stdClass());
    cache_put($acFile, $ac);
  }

  // Route – 30 min Cache je Rufzeichen
  $route = new stdClass();
  if ($cs !== '' && !preg_match('/^D[A-Z]{4}$/', $cs)) {          // deutsche Privatkennzeichen haben keine Route
    $rtFile = "$cacheDir/rt_$cs.json";
    $rt = cache_get($rtFile, 1800);
    if ($rt === false) {
      $r = array();
      $post = json_encode(array('planes' => array(array('callsign' => $cs, 'lat' => $plat, 'lng' => $plon))));
      $j = json_decode(http_get('https://api.adsb.lol/api/0/routeset', $post), true);
      if (is_array($j) && isset($j[0]) && isset($j[0]['airport_codes']) && $j[0]['airport_codes'] !== 'unknown') {
        $aps = array();
        if (isset($j[0]['_airports']) && is_array($j[0]['_airports'])) {
          foreach ($j[0]['_airports'] as $a) {
            $aps[] = array('icao' => isset($a['icao']) ? $a['icao'] : '', 'iata' => isset($a['iata']) ? $a['iata'] : '',
                           'name' => isset($a['location']) ? $a['location'] : (isset($a['name']) ? $a['name'] : ''));
          }
        }
        $r = array('codes' => $j[0]['airport_codes'], 'airports' => $aps,
                   'plausible' => isset($j[0]['plausible']) ? (bool)$j[0]['plausible'] : null, 'src' => 'adsb.lol');
      } else {
        $h = json_decode(http_get("https://hexdb.io/api/v1/route/icao/$cs"), true);
        if (is_array($h) && !empty($h['route'])) {
          $aps = array();
          foreach (explode('-', $h['route']) as $icao) {
            $a = json_decode(http_get('https://hexdb.io/api/v1/airport/icao/' . urlencode($icao)), true);
            $aps[] = array('icao' => $icao, 'iata' => is_array($a) && isset($a['iata']) ? $a['iata'] : '',
                           'name' => is_array($a) && isset($a['airport']) ? $a['airport'] : '');
          }
          $r = array('codes' => $h['route'], 'airports' => $aps, 'plausible' => null, 'src' => 'hexdb.io');
        }
      }
      $rt = json_encode($r ? $r : new stdClass());
      cache_put($rtFile, $rt);
    }
    $route = json_decode($rt);
  }
  echo json_encode(array('aircraft' => json_decode($ac), 'route' => $route));
  exit;
}

/* ================= Flugzeuge im Umkreis ================= */
if (!isset($_GET['lat'], $_GET['lon'])) { http_response_code(400); echo '{"error":"lat/lon missing","ac":[]}'; exit; }
$lat  = round((float)$_GET['lat'], 2);
$lon  = round((float)$_GET['lon'], 2);
$dist = isset($_GET['dist']) ? (int)$_GET['dist'] : 40;          // Seemeilen
if ($lat < -90 || $lat > 90 || $lon < -180 || $lon > 180) { http_response_code(400); echo '{"error":"bad position"}'; exit; }
$dist = max(5, min(100, $dist));

$cache = $cacheDir . '/' . md5("$lat|$lon|$dist") . '.json';
$hit = cache_get($cache, 8);
if ($hit !== false) { echo $hit; exit; }

$sources = array(
  "https://api.airplanes.live/v2/point/$lat/$lon/$dist",
  "https://api.adsb.lol/v2/lat/$lat/lon/$lon/dist/$dist",
);
$keep = array_flip(array('hex','flight','r','t','lat','lon','alt_baro','alt_geom','gs','track','true_heading','seen_pos',
  'baro_rate','geom_rate','squawk','emergency','category','nav_altitude_mcp','ias','mach','wd','ws','oat'));

foreach ($sources as $url) {
  $j = json_decode(http_get($url), true);
  if (is_array($j) && isset($j['ac']) && is_array($j['ac'])) {
    $ac = array();
    foreach ($j['ac'] as $a) { if (is_array($a)) $ac[] = array_intersect_key($a, $keep); }
    $out = json_encode(array('ac' => $ac, 'now' => time(), 'src' => parse_url($url, PHP_URL_HOST)));
    cache_put($cache, $out);
    trail_record($ac);
    echo $out;
    exit;
  }
}
if (is_file($cache)) { readfile($cache); exit; }
http_response_code(502);
echo '{"error":"upstream","ac":[]}';
