import asyncio
import websockets

async def test_ws():
    try:
        async with websockets.connect("ws://127.0.0.1:8000/ws/?nickname=test&skin=rainbow&client_id=4b56be76-f442-43e3-b398-c2d5dc28515f") as ws:
            print("Connected!")
            msg = await ws.recv()
            print("Received bytes:", len(msg))
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_ws())
