fetch('http://localhost:5000/api/cracks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        date: "2026-05-20",
        time: "20:00",
        latitude: "26.297857",
        longitude: "89.454635"
    })
})
.then(res => res.json())
.then(data => console.log("🎉 SUCCESS FROM SERVER:", data))
.catch(err => console.error("❌ ERROR:", err));