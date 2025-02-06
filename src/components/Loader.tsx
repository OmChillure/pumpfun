"use client";

import { motion } from "framer-motion";

export default function DiagonalLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="relative w-24 h-12 -rotate-45">
        {/* Add the background line */}
        <div
          className="absolute inset-0 w-full h-0.5 bg-black top-1/2 -translate-y-1/2 -left-8 -right-8"
          style={{ width: "calc(100% + 4rem)" }}
        />

        <div className="absolute inset-0 border-2 border-emerald-500 rounded-sm overflow-hidden">
          <motion.div
            className="absolute left-0 bottom-0 w-full"
            initial={{ height: 0 }}
            animate={{ height: "100%" }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>

        <motion.div
          className="absolute inset-0 bg-emerald-500 rounded-sm origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>
    </div>
  );
}