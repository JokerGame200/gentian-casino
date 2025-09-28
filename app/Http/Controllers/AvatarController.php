<?php
// app/Http/Controllers/AvatarController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AvatarController extends Controller
{
    public function placeholder(Request $request)
    {
        $name = trim($request->query('name', 'User'));
        $size = max(32, min((int)$request->query('s', 128), 512));

        // Initialen: max 2 Buchstaben
        $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY);
        $initials = mb_strtoupper(mb_substr($parts[0] ?? 'U', 0, 1) .
                                  mb_substr($parts[1] ?? '', 0, 1));

        // Farbton stabil aus dem Namen
        $h = crc32($name) % 360;
        $bg = "hsl($h,70%,40%)";

        $fontSize = (int) round($size * 0.42);

        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$size" height="$size">
  <rect width="100%" height="100%" fill="$bg"/>
  <text x="50%" y="50%" dy=".1em" font-family="Inter,Arial,Helvetica,sans-serif"
        font-size="$fontSize" fill="#fff" text-anchor="middle" dominant-baseline="middle">
    {$initials}
  </text>
</svg>
SVG;

        return response($svg, 200)
            ->header('Content-Type', 'image/svg+xml')
            ->header('Cache-Control', 'public, max-age=31536000');
    }
}
