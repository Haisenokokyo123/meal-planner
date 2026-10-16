<?php
declare(strict_types=1);

// Single Apache entry point. The PHP development server can use this file as its router.
$requestPath = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
$configuredBase = trim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/.');
if (PHP_SAPI === 'cli-server') $configuredBase = trim((string)(getenv('SAKTO_BASE_PATH') ?: ''), '/');
$basePath = $configuredBase === '' ? '' : '/' . $configuredBase;
$path = $basePath !== '' && str_starts_with($requestPath, $basePath . '/') ? substr($requestPath, strlen($basePath)) : $requestPath;
if ($requestPath === $basePath) $path = '/';
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

if ($path === '/api' || str_starts_with($path, '/api/')) {
    $segments = array_values(array_filter(explode('/', trim(substr($path, 4), '/')), fn($value) => $value !== ''));
    require __DIR__ . '/server/api.php';
    exit;
}
// Only generated public assets are served. Source files, SQL, config, and mail are never exposed.
if (preg_match('#^/(assets|images)/[a-zA-Z0-9_./-]+$#', $path) || $path === '/icon.svg') {
    $root = realpath(__DIR__ . '/dist');
    $file = realpath(__DIR__ . '/dist' . $path);
    if ($root && $file && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file)) {
        $types = ['js'=>'text/javascript','css'=>'text/css','webp'=>'image/webp','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','svg'=>'image/svg+xml','woff'=>'font/woff','woff2'=>'font/woff2'];
        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!isset($types[$extension])) { http_response_code(404); exit; }
        header('Content-Type: '.$types[$extension]);
        header('Cache-Control: public, max-age=86400');
        readfile($file); exit;
    }
    http_response_code(404); exit;
}
if (preg_match('#(?:^|/)\.[^/]*|(?:^|/)(?:server|scripts|src|tests|e2e|node_modules|docs|prisma|dist|public)(?:/|$)|\.(?:php|sql|json|lock|md|ts|tsx|map|env)$#i', $path) && $path !== '/index.php') { http_response_code(404); exit; }
$html = @file_get_contents(__DIR__ . '/dist/index.html');
if ($html === false) { http_response_code(503); header('Content-Type: text/plain; charset=UTF-8'); echo 'The frontend build is missing. Run npm ci and npm run build in this folder.'; exit; }
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');
$runtime = '<base href="' . htmlspecialchars($basePath . '/', ENT_QUOTES, 'UTF-8') . '"><script>window.__SAKTO_BASE__=' . json_encode($basePath, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) . ';</script>';
echo str_replace('<!--SAKTO_RUNTIME-->', $runtime, $html);
