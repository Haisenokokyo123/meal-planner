<?php
declare(strict_types=1);
namespace Sakto;

final class Models {
    public static function meal(array $row): array {
        $keys=['id','slug','name','description','category','price','calories','protein','carbs','fat','servingSize','ingredients','allergens','tags','slots','image','available','capacity','portions'];
        $meal=array_intersect_key($row,array_flip($keys));
        foreach(['ingredients','allergens','tags','slots','portions'] as $key) $meal[$key]=json_decode($row[$key],true,32,JSON_THROW_ON_ERROR);
        foreach(['price','calories','capacity'] as $key) $meal[$key]=(int)$row[$key];
        foreach(['protein','carbs','fat'] as $key) $meal[$key]=(float)$row[$key];
        $meal['available']=(bool)$row['available'];return $meal;
    }
    public static function meals(): array {return array_map(self::meal(...),DB::all('SELECT * FROM meals ORDER BY createdAt, slug'));}
    public static function profile(string $userId): array {
        $row=DB::one('SELECT data FROM profiles WHERE userId=?',[$userId]);
        if(!$row)throw new ApiError('Complete your meal preferences first.',409);
        return json_decode($row['data'],true,32,JSON_THROW_ON_ERROR);
    }
    public static function ownedPlan(string $id,string $userId): array {
        $row=DB::one('SELECT * FROM plans WHERE id=? AND userId=?',[$id,$userId]);
        if(!$row)throw new ApiError('Meal plan not found.',404);return $row;
    }
    public static function plan(array $row): array {
        $slots=DB::all("SELECT * FROM plan_slots WHERE planId=? ORDER BY day, FIELD(slot,'breakfast','lunch','dinner')",[$row['id']]);
        foreach($slots as &$slot){unset($slot['planId']);$slot['day']=(int)$slot['day'];$slot['portion']=(float)$slot['portion'];$slot['locked']=(bool)$slot['locked'];$slot['meal']=self::meal(DB::one('SELECT * FROM meals WHERE id=?',[$slot['mealId']]));}unset($slot);
        return ['id'=>$row['id'],'weekStart'=>$row['weekStart'],'revision'=>(int)$row['revision'],'status'=>$row['status'],'slots'=>$slots,'totals'=>Planner::totals($slots),'profile'=>json_decode($row['profileData'],true,32,JSON_THROW_ON_ERROR),'nutrition'=>json_decode($row['nutritionData'],true,32,JSON_THROW_ON_ERROR)];
    }
    public static function order(array $row,bool $admin=false): array {
        $order=array_intersect_key($row,array_flip(['id','status','mealTotal','deliveryFee','total','address','zoneName','paymentMethod']));
        foreach(['mealTotal','deliveryFee','total'] as $key)$order[$key]=(int)$order[$key];
        $order['createdAt']=isoDate($row['createdAt']);
        $items=DB::all("SELECT * FROM order_items WHERE orderId=? ORDER BY deliveryDate, FIELD(slot,'breakfast','lunch','dinner')",[$row['id']]);
        foreach($items as &$item){unset($item['orderId']);foreach(['day','price'] as $key)$item[$key]=(int)$item[$key];foreach(['portion','calories','protein','carbs','fat'] as $key)$item[$key]=(float)$item[$key];}unset($item);
        $order['items']=$items;$order['history']=array_map(fn($h)=>['status'=>$h['status'],'createdAt'=>isoDate($h['createdAt'])],DB::all('SELECT * FROM order_history WHERE orderId=? ORDER BY createdAt,id',[$row['id']]));
        $order['exceptions']=[];
        if(in_array($row['status'],['CONFIRMED','PREPARING','OUT_FOR_DELIVERY'],true))foreach(DB::all('SELECT DISTINCT i.name FROM order_items i JOIN meals m ON m.id=i.mealId WHERE i.orderId=? AND m.available=0',[$row['id']])as $m)$order['exceptions'][]=$m['name'].' is now unavailable; kitchen review required.';
        if($admin)$order['user']=publicUser(DB::one('SELECT * FROM users WHERE id=?',[$row['userId']]));return $order;
    }
    public static function subscription(array $row): array {return ['id'=>$row['id'],'status'=>$row['status'],'packageName'=>$row['packageName'],'weekStart'=>$row['weekStart'],'nextCycle'=>$row['nextCycle'],'mealCount'=>(int)$row['mealCount']];}
    public static function settings(): array {
        $row=DB::one("SELECT * FROM settings WHERE id='main'");if(!$row)throw new ApiError('Run the initial database setup first.',503);
        return ['cutoffHours'=>(int)$row['cutoffHours'],'deliveryWindow'=>$row['deliveryWindow'],'supportedDays'=>json_decode($row['supportedDays'],true,32,JSON_THROW_ON_ERROR)];
    }
    public static function audit(string $userId,string $action): void {DB::exec('INSERT INTO audit_logs (id,userId,action) VALUES (?,?,?)',[id(),$userId,$action]);}
}
