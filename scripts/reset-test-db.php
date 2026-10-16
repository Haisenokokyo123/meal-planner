<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/server/bootstrap.php';
use function Sakto\config;
$name=getenv('DB_NAME');
if($name!=='sakto_meals_e2e'){fwrite(STDERR,"Only the dedicated sakto_meals_e2e database can be reset.\n");exit(1);}
$socket=config('DB_SOCKET');$dsn=$socket?'mysql:unix_socket='.$socket:'mysql:host='.config('DB_HOST').';port='.(int)config('DB_PORT',3306);
$db=new PDO($dsn,(string)config('DB_USER'),(string)config('DB_PASSWORD',''),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('DROP DATABASE IF EXISTS `sakto_meals_e2e`');
