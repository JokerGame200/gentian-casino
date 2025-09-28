<!DOCTYPE html>
<html class="h-full bg-gray-100" lang="{{ str_replace('_','-',app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    @env('local')
        @viteReactRefresh
    @endenv

    @vite(['resources/js/app.jsx'])
    @routes
</head>
<body class="h-full">
    @inertia
</body>
</html>
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title inertia>{{ config('app.name', 'Laravel') }}</title>
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx','resources/css/app.css'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
