import requests
from bs4 import BeautifulSoup

URL = "https://www.blueapron.com/cookbook"
headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
page = requests.get(URL, headers=headers)
print(page.status_code)

soup = BeautifulSoup(page.content, "html.parser")
results = soup.find(id="ResultsContainer")
print(results)  # None means the element isn't in the raw HTML

if results is None:
    raise SystemExit("ResultsContainer not found in the raw HTML")