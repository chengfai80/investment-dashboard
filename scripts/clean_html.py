import os
import re

html_path = '/home/chengfai/.openclaw/workspace/portfolio.html'
with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Since we can't expose the PAT to the frontend in a public repo, we have to change the behavior of the "Request Re-Deploy" button.
# Instead of making the API call directly from the browser (which requires the token to be in the HTML),
# we will remove the button entirely to keep the repo completely clean of tokens.
# The cron job will handle regular updates.

content = re.sub(r'<button onclick="triggerGitHubAction\(\)".*?</button>', '', content)
content = re.sub(r'async function triggerGitHubAction\(\) \{.*?(?=</script>)', '', content, flags=re.DOTALL)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)
