<?php
declare(strict_types=1);
namespace Sakto;

final class Auth {
    public static function cookie(string $token,int $expires): void {
        $path=rtrim((string)(parse_url(appUrl(),PHP_URL_PATH)??''),'/');
        setcookie('sakto_session',$token,['expires'=>$expires,'path'=>$path?:'/','secure'=>str_starts_with(appUrl(),'https://'),'httponly'=>true,'samesite'=>'Lax']);
    }
    public static function session(string $userId): void {
        $token=bin2hex(random_bytes(32));$expires=time()+7*86400;
        DB::exec('INSERT INTO sessions (id,tokenHash,userId,expiresAt) VALUES (?,?,?,?)',[id(),hash('sha256',$token),$userId,gmdate('Y-m-d H:i:s',$expires)]);
        self::cookie($token,$expires);
    }
    public static function handle(string $action,string $method): mixed {
        if($action==='me'&&$method==='GET'){ $user=currentUser();return $user?publicUser($user):null; }
        if($method!=='POST')throw new ApiError('Route not found.',404);
        $body=input();
        if($action==='logout'){if(isset($_COOKIE['sakto_session']))DB::exec('DELETE FROM sessions WHERE tokenHash=?',[hash('sha256',$_COOKIE['sakto_session'])]);self::cookie('',time()-3600);return ['ok'=>true];}
        if(in_array($action,['register','login','forgot-password'],true)){
            $email=Validators::email(Validators::text($body['email']??null,'Email',3,254));authRateLimit($action,$email,$action==='login'?10:5);
            $user=DB::one('SELECT * FROM users WHERE email=?',[$email]);
            if($action==='register'){
                $name=Validators::text($body['name']??null,'Name',2,80);$password=Validators::password(self::passwordInput($body,'password'));
                if($user)throw new ApiError('An account with this email already exists. Try signing in or resetting your password.',409);
                $userId=id();DB::exec("INSERT INTO users (id,name,email,passwordHash,role) VALUES (?,?,?,?,'CUSTOMER')",[$userId,$name,$email,password_hash($password,PASSWORD_BCRYPT,['cost'=>12])]);
                self::session($userId);return publicUser(DB::one('SELECT * FROM users WHERE id=?',[$userId]));
            }
            if($action==='login'){
                $password=self::passwordInput($body,'password');$valid=password_verify($password,$user['passwordHash']??'$2y$12$JpZwPFuI5WfMsaDXwnOFR.x71laj99Ra.efkj46cGVbm7X49cLtyq');
                if(!$user||$user['deletedAt']||!$valid)throw new ApiError('Email or password is incorrect.',401);
                self::session($user['id']);return publicUser($user);
            }
            if($user&&!$user['deletedAt']){
                $token=bin2hex(random_bytes(32));DB::transaction(function()use($user,$token){DB::exec('DELETE FROM reset_tokens WHERE userId=?',[$user['id']]);DB::exec('INSERT INTO reset_tokens (id,tokenHash,userId,expiresAt) VALUES (?,?,?,?)',[id(),hash('sha256',$token),$user['id'],gmdate('Y-m-d H:i:s',time()+1800)]);});
                $outbox=(string)config('MAIL_OUTBOX_DIR',__DIR__.'/storage/outbox');if(!is_dir($outbox)&&!mkdir($outbox,0700,true))throw new \RuntimeException('Could not create local mail outbox.');
                $file=$outbox.'/'.id().'.json';if(file_put_contents($file,jsonEncode(['to'=>$email,'subject'=>'Reset your Sakto Meals password','resetUrl'=>appUrl().'/reset-password?token='.$token,'expiresInMinutes'=>30]),LOCK_EX)===false)throw new \RuntimeException('Could not write reset message.');@chmod($file,0600);
            }
            return ['ok'=>true];
        }
        if($action==='reset-password'){
            $token=Validators::text($body['token']??null,'Reset token',64,64);$password=Validators::password(self::passwordInput($body,'password'));authRateLimit('reset-use',hash('sha256',$token),10);
            $hash=password_hash($password,PASSWORD_BCRYPT,['cost'=>12]);
            DB::transaction(function()use($token,$hash){
                $reset=DB::one('SELECT r.* FROM reset_tokens r JOIN users u ON u.id=r.userId WHERE r.tokenHash=? AND r.expiresAt>UTC_TIMESTAMP(3) AND u.deletedAt IS NULL FOR UPDATE',[hash('sha256',$token)]);
                if(!$reset)throw new ApiError('This reset link is invalid, used, or expired.');
                DB::exec('UPDATE users SET passwordHash=? WHERE id=?',[$hash,$reset['userId']]);DB::exec('DELETE FROM sessions WHERE userId=?',[$reset['userId']]);DB::exec('DELETE FROM reset_tokens WHERE userId=?',[$reset['userId']]);
            });self::cookie('',time()-3600);return ['ok'=>true];
        }
        if($action==='change-password'){
            $user=requireUser();authRateLimit('password-change',$user['id'],8);$password=Validators::password(self::passwordInput($body,'password'));
            if(!password_verify(self::passwordInput($body,'currentPassword'),$user['passwordHash']))throw new ApiError('Your current password is incorrect.');
            $hash=password_hash($password,PASSWORD_BCRYPT,['cost'=>12]);DB::transaction(function()use($user,$hash){DB::exec('UPDATE users SET passwordHash=? WHERE id=?',[$hash,$user['id']]);DB::exec('DELETE FROM sessions WHERE userId=?',[$user['id']]);DB::exec('DELETE FROM reset_tokens WHERE userId=?',[$user['id']]);});self::session($user['id']);return ['ok'=>true];
        }
        throw new ApiError('Route not found.',404);
    }
    public static function passwordInput(array $body,string $key): string {if(!isset($body[$key])||!is_string($body[$key])||strlen($body[$key])>200||str_contains($body[$key],"\0"))throw new ApiError('Enter a valid password.');return $body[$key];}
}
