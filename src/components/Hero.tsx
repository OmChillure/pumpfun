"use client"

import { useState } from "react"
import { Search } from 'lucide-react'
import { motion } from "framer-motion"

export default function PumpBoost() {
  const [search, setSearch] = useState("")

  return (
    <div className="max-w-4xl mx-auto text-center py-9 px-4">
      <motion.h1 
        className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 font-sans leading-tight"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Create Pump.fun Tokens with{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-800">
          PumpBoost.fun
        </span>
      </motion.h1>
      <motion.p 
        className="text-lg md:text-xl text-gray-600 mb-10  max-w-4xl mx-auto leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Effortlessly boost your coins outreach and market them like a pro. With{" "} PumpBoost.fun, generate multiple Pump.fun marketing tokens to amplify
        your presence and maximize efficiency.
      </motion.p>
    </div>
  )
}

