from openai import OpenAI

client = OpenAI(api_key="")

response = client.chat.completions.create(
    model="gpt-5-mini",
    messages=[
        # {"role": "system", "content": "You are a goofy AI just trying to tell some jokes"},
        {"role": "user", "content": "Greet me warmly using a not-joke"},
        # {"role": "assistant", "content": "I am unhappy to see you .... NOT!"},
    ],
)

print(response.choices[0].message.content)