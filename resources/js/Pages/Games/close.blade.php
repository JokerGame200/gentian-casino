<!doctype html>
<html>
<head><meta charset="utf-8"><title>Closing…</title></head>
<body>
<script>
  try {
    if (window.top && window.top !== window) {
      window.top.postMessage('closeGame', '*');
    }
  } catch (e) {}
</script>
</body>
</html>
