import os
from dotenv import load_dotenv, find_dotenv
from google import genai

# Force python-dotenv to find and override any existing terminal environment variables
load_dotenv(find_dotenv(), override=True)

api_key = os.getenv("GEMINI_API_KEY")

# Verify the key is loaded before making the request
if not api_key:
    raise ValueError("GEMINI_API_KEY was not found in environment variables.")

client = genai.Client(api_key=api_key)

response = client.models.generate_content_stream(
    model="gemini-3.8-flash",
    contents="Politely greet me using a classic not-joke",
)

for chunk in response:
    print(chunk.text, end="")