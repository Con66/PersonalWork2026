import Card from "./components/Card";

function App() {
  const testCards = [
    { suit: "hearts",   value: 1  },
    { suit: "spades",   value: 13 },
    { suit: "diamonds", value: 11 },
  ];

  return (
    <div className="table">
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
        {testCards.map((card, i) => (
          <Card
            key={i}
            suit={card.suit}
            value={card.value}
            onClick={() => console.log(`Clicked ${card.value} of ${card.suit}`)}
          />
        ))}
        <Card faceDown={true} suit="clubs" value={5} />
      </div>
    </div>
  );
}

export default App;