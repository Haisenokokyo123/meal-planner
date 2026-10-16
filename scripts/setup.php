<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once dirname(__DIR__).'/server/bootstrap.php';
require_once dirname(__DIR__).'/server/Validators.php';
use Sakto\{DB,Validators};
use function Sakto\{config,id,jsonEncode};
try {
    if(!extension_loaded('pdo_mysql'))throw new RuntimeException('Enable extension=pdo_mysql in php.ini and restart Apache.');
    $name=(string)config('DB_NAME');if(!preg_match('/^[A-Za-z0-9_]+$/D',$name))throw new RuntimeException('Invalid database name.');
    $socket=config('DB_SOCKET');$dsn=$socket?'mysql:unix_socket='.$socket:'mysql:host='.config('DB_HOST').';port='.(int)config('DB_PORT',3306);
    $connection=new PDO($dsn.';charset=utf8mb4',(string)config('DB_USER'),(string)config('DB_PASSWORD',''),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $connection->exec('CREATE DATABASE IF NOT EXISTS `'.$name.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    DB::pdo()->exec(file_get_contents(dirname(__DIR__).'/server/schema.sql'));
    $seed=json_decode(file_get_contents(dirname(__DIR__).'/server/seed-data.json'),true,64,JSON_THROW_ON_ERROR);
    DB::transaction(function()use($seed){
        foreach($seed['meals'] as $meal){$data=Validators::meal($meal);$data=['id'=>$meal['id'],...$data];foreach(['ingredients','allergens','tags','slots','portions']as $key)$data[$key]=jsonEncode($data[$key]);$data['available']=(int)$data['available'];
            if(!DB::one('SELECT id FROM meals WHERE slug=?',[$meal['slug']]))DB::exec('INSERT INTO meals (`'.implode('`,`',array_keys($data)).'`) VALUES ('.implode(',',array_fill(0,count($data),'?')).')',array_values($data));
        }
        foreach($seed['packages'] as $p)if(!DB::one('SELECT id FROM packages WHERE id=?',[$p['id']]))DB::exec('INSERT INTO packages (id,name,mealCount,price,description,active) VALUES (?,?,?,?,?,?)',[$p['id'],$p['name'],$p['mealCount'],$p['price'],$p['description'],(int)$p['active']]);
        foreach($seed['zones'] as $z)if(!DB::one('SELECT id FROM delivery_zones WHERE id=?',[$z['id']]))DB::exec('INSERT INTO delivery_zones (id,name,fee,active) VALUES (?,?,?,?)',[$z['id'],$z['name'],$z['fee'],(int)$z['active']]);
        if(!DB::one("SELECT id FROM settings WHERE id='main'"))DB::exec("INSERT INTO settings (id,cutoffHours,deliveryWindow,supportedDays) VALUES ('main',24,'8:00 AM – 12:00 PM','[0,1,2,3,4,5,6]')");
    });
    $password=getenv('DEMO_ADMIN_PASSWORD');$create=in_array('--admin',$argv,true)||($password!==false&&$password!=='');
    if($create){$email=Validators::email(getenv('DEMO_ADMIN_EMAIL')?:'admin@sakto.test');if(!DB::one('SELECT id FROM users WHERE email=?',[$email])){
        $generated=!$password;$password=$password?:'Sakto-'.bin2hex(random_bytes(12)).'!';Validators::password($password);
        DB::exec("INSERT INTO users (id,name,email,passwordHash,role) VALUES (?, 'Sakto Administrator', ?, ?, 'ADMIN')",[id(),$email,password_hash($password,PASSWORD_BCRYPT,['cost'=>12])]);
        if($generated){$dir=dirname(__DIR__).'/.local';if(!is_dir($dir))mkdir($dir,0700,true);file_put_contents($dir.'/admin-credentials.txt',"Local demonstration administrator\nEmail: $email\nPassword: $password\nChange this password after signing in.\n",LOCK_EX);@chmod($dir.'/admin-credentials.txt',0600);echo "Administrator created. Read .local/admin-credentials.txt privately, then change the password.\n";}
        else echo "Administrator created from supplied environment variables.\n";
    }else echo "Existing administrator preserved; password was not changed.\n";}
    echo "Database ready: 24 demo meals, 4 packages, 5 delivery areas. Existing records preserved.\n";
}catch(Throwable $error){fwrite(STDERR,"Setup failed: ".$error->getMessage()."\n");exit(1);}
