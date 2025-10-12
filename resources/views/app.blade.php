<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'Play4Cash') }}</title>

        @env('local')
            @viteReactRefresh
        @endenv
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
