/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['DM Sans', 'Avenir Next', 'sans-serif'],
			},
		},
	},
	plugins: [],
};