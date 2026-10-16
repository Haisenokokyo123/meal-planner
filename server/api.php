<?php
declare(strict_types=1);
namespace Sakto;
require_once __DIR__.'/bootstrap.php';
foreach(['Validators','Planner','Models','Auth','Core','Plans','Admin'] as $class)require_once __DIR__."/$class.php";
try {
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if(!in_array($method,['GET','POST','PUT','PATCH','DELETE'],true))throw new ApiError('Method not supported.',405);
    if($method!=='GET')assertSameOrigin();
    $segments=$segments??[];$root=$segments[0]??'';
    if($root==='auth'&&count($segments)===2)respond(Auth::handle($segments[1],$method));
    if($root==='meals'&&$method==='GET'){
        if(count($segments)===1)respond(Models::meals());
        if(count($segments)===2){$meal=DB::one('SELECT * FROM meals WHERE slug=?',[$segments[1]]);if(!$meal)throw new ApiError('Meal not found.',404);respond(Models::meal($meal));}
    }
    if($root==='packages'&&count($segments)===1&&$method==='GET')respond(Core::packages());
    if($root==='settings'&&count($segments)===1&&$method==='GET')respond(Core::configuration());
    if($root==='contact'&&count($segments)===1&&$method==='POST')respond(Core::contact());
    $user=requireUser($root==='admin');
    if($root==='admin')respond(Admin::handle($segments,$method,$user));
    if($root==='plans')respond(Plans::handle($segments,$method,$user));
    if($root==='checkout'&&count($segments)===1&&$method==='POST')respond(Plans::checkout($user));
    if($root==='subscriptions'&&count($segments)===2&&$method==='PATCH')respond(Plans::subscription($segments[1],$user));
    respond(Core::handle($segments,$method,$user));
}catch(ApiError $error){http_response_code($error->status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');echo jsonEncode(['error'=>$error->getMessage()]);}
catch(\Throwable $error){error_log('Sakto API error: '.$error->getMessage());http_response_code(500);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');echo jsonEncode(['error'=>'The service could not complete this request. Check the database setup or try again.']);}
