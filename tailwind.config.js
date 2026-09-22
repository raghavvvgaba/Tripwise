/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#17201B",
        muted: "#68736C",
        canvas: "#F5F7F5",
        surface: "#FFFFFF",
        line: "#E3E9E5",
        brand: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          500: "#10A66A",
          600: "#078455",
          700: "#086B49"
        },
        coral: "#F0785A"
      }
    }
  },
  plugins: []
};
