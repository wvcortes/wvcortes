/** Paleta e tipografia da marca. Altere aqui para mudar o visual do sistema inteiro. */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        tinta: "#08110f",
        couro: "#123f35",
        couroClaro: "#1b594a",
        latao: "#c8a969",
        latauEscuro: "#9d7d3f",
        marfim: "#f2f0e9",
        papel: "#fbfaf6",
        fumaca: "#756f66",
        linha: "#dcd7cc",
      },
      fontFamily: {
        display: ["'Bodoni Moda'", "Georgia", "serif"],
        corpo: ["Karla", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        carta: "0 1px 2px rgba(8,17,15,.05), 0 18px 48px -24px rgba(8,17,15,.24)",
      },
    },
  },
  plugins: [],
};
