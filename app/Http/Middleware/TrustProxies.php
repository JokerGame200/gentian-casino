<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Illuminate\Http\Middleware\TrustProxies as Middleware;

class TrustProxies extends Middleware
{
    /**
     * Wenn du hinter Cloudflare/Proxy hängst, nimm '*' (oder liste deine Proxy-IP(s)).
     *
     * @var array<int, string>|string|null
     */
    protected $proxies = '*';

    /**
     * Welche Forwarded-Header vertraut werden.
     *
     * @var int
     */
    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}
