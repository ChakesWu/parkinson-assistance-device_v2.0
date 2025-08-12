import * as React from "react"

export default function MinimalistDock() {
  return (
    <div className="flex space-x-2 p-2 bg-white/10 backdrop-blur-md rounded-full border border-gray-200 dark:border-gray-800">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-xs">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}