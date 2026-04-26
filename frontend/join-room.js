import io from "socket.io-client";

const socket = io("http://localhost:3001", {
    transports: ["websocket"],
});

socket.on("connect", () => {
    console.log("Conectado:", socket.id);

    socket.emit("join-room", {
        roomId: "db51f3ae-21e7-4b12-bd96-2a85a6a51137",
        pin: "1234",
        nickname: "Jeff",
    });
});

socket.on("join-success", (data) => {
    console.log("Unido a la sala:", data);
});

socket.on("user-joined", (data) => {
    console.log("Usuario unido:", data);
});

socket.on("error", (err) => {
    console.error("Error:", err);
});
