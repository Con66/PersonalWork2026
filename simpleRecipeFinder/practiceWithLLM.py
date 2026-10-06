from google import genai
from dotenv import load_dotenv

load_dotenv()

client = genai.Client()

stream = client.interactions.create(
    model="gemini-3.8-flash",
    input="Politely greet me using a classic not-joke",
    stream=True
)
for event in stream:
    print(event)