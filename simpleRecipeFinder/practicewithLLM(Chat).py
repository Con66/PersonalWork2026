from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI()

response = client.responses.create(
    model="gpt-5.4-mini",
    input="Greet me warmly using a not-joke"
)

print(response.output_text)