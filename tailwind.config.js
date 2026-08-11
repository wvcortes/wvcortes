/** Paleta e tipografia da marca. Altere aqui para mudar o visual do sistema inteiro. */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        tinta: "#14100E",
        couro: "#6B1F2A",
        couroClaro: "#8A2C39",
        latao: "#C8A24A",
        latauEscuro: "#9C7A2E",
        marfim: "#F5EFE6",
        papel: "#FBF8F3",
        fumaca: "#8A8078",
        linha: "#E2D9CC",
      },
      fontFamily: {
        display: ["'Bodoni Moda'", "Georgia", "serif"],
        corpo: ["Karla", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        carta: "0 1px 2px rgba(20,16,14,.06), 0 12px 32px -12px rgba(20,16,14,.18)",
      },
    },
  },
  plugins: [],
};
