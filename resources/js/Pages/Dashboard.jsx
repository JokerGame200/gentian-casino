"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Head from "next/head"
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout"

export default function Dashboard() {
  const user = {
    name: "John Doe",
    email: "john@example.com",
    balance: 1234.56,
    currency: "EUR",
    profile_photo_url: null,
  }

  const balance = Number(user.balance ?? 0)
  const currency = user.currency ?? "EUR"

  const [activeCategory, setActiveCategory] = useState("All")
  const [showBalanceMenu, setShowBalanceMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showCategoriesSheet, setShowCategoriesSheet] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Format currency helper
  function formatCurrency(value, curr) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: curr,
      }).format(value)
    } catch {
      return value.toFixed(2) + " " + curr
    }
  }

  // Get user initials
  function getInitials(name) {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Categories
  const categories = [
    "All",
    "Popular",
    "New",
    "Exclusive",
    "Buy Bonus",
    "Crash",
    "Table",
    "Arcade",
    "Provider",
    "Themes",
  ]

  // Mock game data
  const mockGames = useMemo(() => {
    const providers = ["NetEnt", "Pragmatic", "Evolution", "Play'n GO", "Microgaming", "Yggdrasil"]
    const gameTypes = ["Popular", "New", "Exclusive", "Buy Bonus", "Crash", "Table", "Arcade"]

    return Array.from({ length: 120 }, (_, i) => ({
      id: i + 1,
      title: `Game ${i + 1}`,
      provider: providers[i % providers.length],
      category: gameTypes[i % gameTypes.length],
      image: `data:image/svg+xml;base64,${btoa(`<svg width="320" height="180" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad${i}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:hsl(${(i * 137.5) % 360}, 70%, 50%);stop-opacity:1" /><stop offset="100%" style="stop-color:hsl(${(i * 137.5 + 60) % 360}, 70%, 30%);stop-opacity:1" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#grad${i})"/><text x="50%" y="50%" fontFamily="Arial" fontSize="16" fill="white" textAnchor="middle" dy=".3em">Game ${i + 1}</text></svg>`)}`,
    }))
  }, [])

  // Filter games by category
  const filteredSections = useMemo(() => {
    const sections = [
      { title: "Popular Games", category: "Popular" },
      { title: "Exclusive Titles", category: "Exclusive" },
      { title: "New Releases", category: "New" },
      { title: "Buy Bonus", category: "Buy Bonus" },
      { title: "Crash & Instant Win", category: "Crash" },
      { title: "Table Games", category: "Table" },
      { title: "Arcade Games", category: "Arcade" },
    ]

    if (activeCategory === "All") {
      return sections.map((section) => ({
        ...section,
        games: mockGames.filter((game) => game.category === section.category).slice(0, 12),
      }))
    }

    return sections
      .filter((section) => section.category === activeCategory)
      .map((section) => ({
        ...section,
        games: mockGames.filter((game) => game.category === section.category).slice(0, 12),
      }))
  }, [activeCategory, mockGames])

  // Game Card Component
  const GameCard = ({ game, isVisible }) => {
    const [isHovered, setIsHovered] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)

    if (!isVisible) {
      return <div className="aspect-video bg-slate-800 rounded-xl animate-pulse" />
    }

    return (
      <div
        className="relative group cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="aspect-video bg-slate-800 rounded-xl overflow-hidden relative">
          {!imageLoaded && <div className="absolute inset-0 bg-slate-800 animate-pulse" />}
          <img
            src={game.image || "/placeholder.svg"}
            alt={game.title}
            loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Provider chip */}
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
            {game.provider}
          </div>

          {/* Favorite heart */}
          <button className="absolute top-2 right-2 w-8 h-8 bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-red-500/70 transition-colors">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Hover overlay */}
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-3 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <button className="bg-white text-slate-900 px-4 py-2 rounded-lg font-medium hover:bg-slate-100 transition-colors">
              Demo
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Play
            </button>
          </div>
        </div>

        <div className="mt-2">
          <h3 className="text-white font-medium text-sm truncate">{game.title}</h3>
        </div>
      </div>
    )
  }

  // Carousel Component with Intersection Observer
  const GameCarousel = ({ section }) => {
    const containerRef = useRef(null)
    const [visibleCards, setVisibleCards] = useState(new Set())

    useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const cardIndex = Number.parseInt(entry.target.dataset.cardIndex)
            if (entry.isIntersecting) {
              setVisibleCards((prev) => new Set([...prev, cardIndex]))
            }
          })
        },
        { rootMargin: "50px" },
      )

      const cards = containerRef.current?.querySelectorAll("[data-card-index]")
      cards?.forEach((card) => observer.observe(card))

      return () => observer.disconnect()
    }, [section.games])

    const scrollLeft = () => {
      containerRef.current?.scrollBy({ left: -320, behavior: "smooth" })
    }

    const scrollRight = () => {
      containerRef.current?.scrollBy({ left: 320, behavior: "smooth" })
    }

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">{section.title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={scrollLeft}
              className="hidden md:flex w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full items-center justify-center text-white transition-colors"
              aria-label="Scroll left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollRight}
              className="hidden md:flex w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-full items-center justify-center text-white transition-colors"
              aria-label="Scroll right"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
              View all
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {section.games.map((game, index) => (
            <div key={game.id} data-card-index={index} className="flex-none w-64">
              <GameCard game={game} isVisible={visibleCards.has(index)} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AuthenticatedLayout>
      <Head>
        <title>Dashboard - Next2Win</title>
      </Head>

      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? "bg-slate-900/95 backdrop-blur-md shadow-lg" : "bg-slate-900"}`}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="text-white font-bold text-lg">Next2Win</div>

            {/* Desktop Categories */}
            <div className="hidden md:flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCategory === category
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Mobile Categories Button */}
            <button
              onClick={() => setShowCategoriesSheet(true)}
              className="md:hidden bg-slate-800 text-slate-300 px-4 py-2 rounded-full text-sm font-medium"
            >
              Categories
            </button>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Balance */}
              <div className="relative">
                <button
                  onClick={() => setShowBalanceMenu(!showBalanceMenu)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  aria-expanded={showBalanceMenu}
                >
                  {formatCurrency(balance, currency)}
                </button>

                {showBalanceMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2">
                    <button className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors">
                      Deposit
                    </button>
                    <button className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors">
                      Withdraw
                    </button>
                    <button className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors">
                      Transactions
                    </button>
                  </div>
                )}
              </div>

              {/* Notifications (hidden on xs) */}
              <button className="hidden sm:flex w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full items-center justify-center text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-5 5v-5zM10.07 2.82l3.12 3.12M7.05 5.84l3.12 3.12M4.03 8.86l3.12 3.12"
                  />
                </svg>
              </button>

              {/* Profile */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center text-white font-medium transition-colors"
                  aria-label={`Profile menu for ${user.name || "User"}`}
                  aria-expanded={showProfileMenu}
                >
                  {user.profile_photo_url ? (
                    <img
                      src={user.profile_photo_url || "/placeholder.svg"}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(user.name)
                  )}
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2">
                    <button className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors">
                      Profile
                    </button>
                    <button className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors">
                      Settings
                    </button>
                    <hr className="border-slate-700 my-2" />
                    <button className="w-full text-left px-4 py-2 text-white hover:bg-slate-700 transition-colors">
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Categories Sheet */}
      {showCategoriesSheet && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCategoriesSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Categories</h3>
              <button
                onClick={() => setShowCategoriesSheet(false)}
                className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setActiveCategory(category)
                    setShowCategoriesSheet(false)
                  }}
                  className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === category ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="bg-slate-900 min-h-screen">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900 px-4 py-12 md:py-16">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                    Spin & Win Up To{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                      €10,000
                    </span>
                  </h1>
                  <p className="text-slate-300 text-lg md:text-xl mb-8 max-w-2xl">
                    Experience the thrill of premium casino games with exclusive bonuses and instant wins.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg transition-colors">
                      Play Now
                    </button>
                    <button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-slate-900 px-8 py-3 rounded-xl font-bold text-lg transition-colors">
                      Learn More
                    </button>
                  </div>
                </div>

                {/* Decorative SVG */}
                <div className="hidden lg:block">
                  <svg width="200" height="200" viewBox="0 0 200 200" className="text-white/20">
                    <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="100" cy="100" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
                    {Array.from({ length: 8 }).map((_, i) => (
                      <line
                        key={i}
                        x1="100"
                        y1="20"
                        x2="100"
                        y2="40"
                        stroke="currentColor"
                        strokeWidth="2"
                        transform={`rotate(${i * 45} 100 100)`}
                      />
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Sections */}
        <div className="px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {filteredSections.map((section) => (
              <GameCarousel key={section.title} section={section} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-slate-800 px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Payment Icons */}
              <div className="flex items-center gap-4">
                <span className="text-slate-400 text-sm">Secure Payments:</span>
                <div className="flex items-center gap-3">
                  {/* Visa */}
                  <div className="w-8 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">V</span>
                  </div>
                  {/* Mastercard */}
                  <div className="w-8 h-6 bg-red-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">M</span>
                  </div>
                  {/* PayPal */}
                  <div className="w-8 h-6 bg-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">P</span>
                  </div>
                  {/* Crypto */}
                  <div className="w-8 h-6 bg-orange-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">₿</span>
                  </div>
                </div>
              </div>

              {/* Support */}
              <div className="flex items-center gap-6">
                <div className="text-slate-400 text-sm">🎧 24/7 Support</div>

                {/* Language Selector */}
                <select className="bg-slate-700 text-white px-3 py-1 rounded text-sm border border-slate-600">
                  <option>🇬🇧 English</option>
                  <option>🇩🇪 Deutsch</option>
                  <option>🇫🇷 Français</option>
                  <option>🇪🇸 Español</option>
                </select>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Click outside handlers */}
      {(showBalanceMenu || showProfileMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowBalanceMenu(false)
            setShowProfileMenu(false)
          }}
        />
      )}
    </AuthenticatedLayout>
  )
}
