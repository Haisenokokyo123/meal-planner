<?php
declare(strict_types=1);
namespace Sakto;

final class Core {
    public static function configuration(bool $admin=false): array {
        $zones=DB::all('SELECT * FROM delivery_zones'.($admin?'':' WHERE active=1').' ORDER BY name');
        foreach($zones as &$zone){$zone['fee']=(int)$zone['fee'];$zone['active']=(bool)$zone['active'];}unset($zone);
        return ['settings'=>Models::settings(),'zones'=>$zones];
    }
    public static function packages(): array {
        $rows=DB::all('SELECT * FROM packages WHERE active=1 ORDER BY mealCount,id');foreach($rows as &$row){$row['mealCount']=(int)$row['mealCount'];$row['price']=(int)$row['price'];$row['active']=(bool)$row['active'];}unset($row);return $rows;
    }
    public static function contact(): array {
        $data=input();$name=Validators::text($data['name']??null,'Name',2,80);$email=Validators::email(Validators::text($data['email']??null,'Email',3,254));$message=Validators::text($data['message']??null,'Message',10,2000);
        authRateLimit('contact',$email,5);DB::exec('INSERT INTO contact_messages (id,name,email,message) VALUES (?,?,?,?)',[id(),$name,$email,$message]);return ['ok'=>true];
    }
    public static function handle(array $segments,string $method,array $user): mixed {
        $resource=$segments[0]??'';$uid=$user['id'];
        if($resource==='profile'&&count($segments)===1){
            if($method==='GET'){$row=DB::one('SELECT data FROM profiles WHERE userId=?',[$uid]);$p=$row?json_decode($row['data'],true,32,JSON_THROW_ON_ERROR):null;return ['profile'=>$p,'nutrition'=>$p?Planner::nutrition($p):null];}
            if($method==='PUT'){$profile=Validators::profile(input());$nutrition=Planner::nutrition($profile);DB::transaction(function()use($uid,$profile){self::lock();DB::exec('INSERT INTO profiles (id,userId,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[id(),$uid,jsonEncode($profile)]);});return ['profile'=>$profile,'nutrition'=>$nutrition];}
            if($method==='DELETE'){DB::transaction(function()use($uid){self::lock();self::clearProfile($uid);});return ['ok'=>true];}
        }
        if($resource==='dashboard'&&count($segments)===1&&$method==='GET'){
            $row=DB::one('SELECT data FROM profiles WHERE userId=?',[$uid]);$profile=$row?json_decode($row['data'],true,32,JSON_THROW_ON_ERROR):null;
            return ['user'=>publicUser($user),'profile'=>$profile,'nutrition'=>$profile?Planner::nutrition($profile):null,'plans'=>array_map(Models::plan(...),DB::all('SELECT * FROM plans WHERE userId=? ORDER BY updatedAt DESC LIMIT 30',[$uid])),'orders'=>array_map(Models::order(...),DB::all('SELECT * FROM orders WHERE userId=? ORDER BY createdAt DESC',[$uid])),'subscriptions'=>array_map(Models::subscription(...),DB::all('SELECT * FROM subscriptions WHERE userId=? ORDER BY createdAt DESC',[$uid])),'weights'=>self::weights($uid),'favorites'=>array_column(DB::all('SELECT mealId FROM favorites WHERE userId=?',[$uid]),'mealId')];
        }
        if($resource==='favorites'&&count($segments)===1&&$method==='POST'){
            $mealId=Validators::text(input()['mealId']??null,'Meal',1,100);if(!DB::one('SELECT id FROM meals WHERE id=?',[$mealId]))throw new ApiError('Meal not found.',404);
            return DB::transaction(function()use($uid,$mealId){self::lock();if(DB::one('SELECT * FROM favorites WHERE userId=? AND mealId=?',[$uid,$mealId]))DB::exec('DELETE FROM favorites WHERE userId=? AND mealId=?',[$uid,$mealId]);else DB::exec('INSERT INTO favorites (userId,mealId) VALUES (?,?)',[$uid,$mealId]);return array_column(DB::all('SELECT mealId FROM favorites WHERE userId=?',[$uid]),'mealId');});
        }
        if($resource==='weights'){
            if(count($segments)===1&&$method==='POST'){$body=input();$weight=Validators::number($body['weight']??null,'Weight',30,350);$date=Validators::text($body['date']??null,'Date',10,10);assertDate($date);if($date>manilaDate())throw new ApiError('Weight entries cannot be dated in the future.');DB::exec('INSERT INTO weights (id,userId,weight,date) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE weight=VALUES(weight)',[id(),$uid,$weight,$date]);return self::weights($uid);}
            if(count($segments)===2&&$method==='DELETE'){if(!DB::exec('DELETE FROM weights WHERE id=? AND userId=?',[$segments[1],$uid]))throw new ApiError('Weight entry not found.',404);return ['ok'=>true];}
        }
        if($resource==='account'&&($segments[1]??'')==='delete'&&count($segments)===2&&$method==='POST'){
            authRateLimit('delete-account',$uid,5);if(!password_verify(Auth::passwordInput(input(),'password'),$user['passwordHash']))throw new ApiError('Your password is incorrect.');
            if($user['role']==='ADMIN')throw new ApiError('Administrators must transfer operational responsibility before removing their account.',409);
            DB::transaction(function()use($uid){self::lock();if(DB::one("SELECT id FROM orders WHERE userId=? AND status IN ('CONFIRMED','PREPARING','OUT_FOR_DELIVERY')",[$uid]))throw new ApiError('Your account has outstanding orders. Ask the administrator to complete or cancel them first.',409);
                self::clearProfile($uid);DB::exec('DELETE FROM plans WHERE userId=?',[$uid]);DB::exec('DELETE FROM favorites WHERE userId=?',[$uid]);DB::exec('DELETE FROM sessions WHERE userId=?',[$uid]);DB::exec('DELETE FROM reset_tokens WHERE userId=?',[$uid]);DB::exec("UPDATE subscriptions SET status='CANCELLED' WHERE userId=?",[$uid]);DB::exec("UPDATE orders SET address='Removed at customer request' WHERE userId=?",[$uid]);DB::exec("UPDATE users SET name='Deleted customer',email=?,passwordHash='',deletedAt=UTC_TIMESTAMP(3) WHERE id=?",['deleted-'.$uid.'@example.invalid',$uid]);
            });Auth::cookie('',time()-3600);return ['ok'=>true];
        }
        throw new ApiError('Route not found.',404);
    }
    private static function clearProfile(string $uid): void {
        DB::exec('DELETE FROM profiles WHERE userId=?',[$uid]);DB::exec('DELETE FROM weights WHERE userId=?',[$uid]);
        // Confirmed orders retain operational snapshots; remove the sensitive plan snapshots too.
        DB::exec('DELETE FROM plans WHERE userId=?',[$uid]);
    }
    private static function weights(string $uid): array {$rows=DB::all('SELECT id,weight,date FROM weights WHERE userId=? ORDER BY date',[$uid]);foreach($rows as &$row)$row['weight']=(float)$row['weight'];return $rows;}
    private static function lock(): void {if(!DB::one("SELECT id FROM settings WHERE id='main' FOR UPDATE"))throw new ApiError('Run the initial database setup first.',503);}
}
