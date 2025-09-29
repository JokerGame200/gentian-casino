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

        <title inertia>{{ config('app.name', 'Play4Cash') }}</title>

        @viteReactRefresh
        @vite(['resources/js/app.jsx'])
        @inertiaHead

        <!-- Favicon -->
        <link rel="icon" type="image/svg+xml" href="{{ asset('img/play4cash-mark.svg') }}">
        <!-- (Optional) Fallbacks -->
        {{-- <link rel="alternate icon" type="image/png" sizes="32x32" href="{{ asset('img/play4cash-32.png') }}"> --}}
        {{-- <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('img/apple-touch-icon.png') }}"> --}}
        {{-- <link rel="mask-icon" href="{{ asset('img/play4cash-mark.svg') }}" color="#0ea5e9"> --}}
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
