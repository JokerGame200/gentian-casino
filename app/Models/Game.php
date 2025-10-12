<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Game extends Model
{
    protected $fillable = ['name','provider','image_path']; // image_path z.B. "games/123.jpg"
    protected $appends = ['image_url'];

    public function getImageUrlAttribute()
    {
        if ($this->image_path) {
            // sorgt für https://…/storage/…
            return asset('storage/'.$this->image_path);
        }
        return null;
    }
}
