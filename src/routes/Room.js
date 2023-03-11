import { useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";

const Room = () => {
  const { id: roomID } = useParams();
  // userVideo и partnerVideo - ссылки на видеоэлементы <video> для отображения потоков видео пользователя и партнера.
  // peerRef - ссылка на объект Peer, который используется для установления соединения WebRTC между пользователями.
  // socketRef - ссылка на объект Socket, который используется для установления соединения WebSocket между клиентом и сервером.
  // otherUser - ссылка на идентификатор другого пользователя в комнате.
  const userVideo = useRef();
  const partnerVideo = useRef();

  const peerRef = useRef();
  const socketRef = useRef();
  const otherUser = useRef();
  const userStream = useRef();

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((stream) => {
        userVideo.current.srcObject = stream;
        userStream.current = stream;
      });

    // присоединяемся к серверу
    socketRef.current = io.connect(
      "https://rtc-socket-express-j3e7v5uu5-pavel-chermyanin.vercel.app:8000"
    );
    // говорим серверу что присоединились
    socketRef.current.emit("join room", roomID);

    // если в комнате кто то был то получим от сервера его id
    // позвоним ему
    // сохраним его id
    socketRef.current.on("other user", (userID) => {
      callUser(userID);
      otherUser.current = userID;
    });

    // Если другой пользователь присоединился к комнате, то клиент получит событие "user joined" с идентификатором этого пользователя и сохранит его идентификатор в объекте otherUser.current.
    socketRef.current.on("user joined", (userID) => {
      otherUser.current = userID;
    });

    socketRef.current.on("offer", handleRecieveCall);
    socketRef.current.on("answer", handleAnswer);
    socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
  }, []);

  //Функция callUser создает новое соединение WebRTC между текущим пользователем и пользователем, чей идентификатор передается в качестве аргумента userID.

  // Внутри функции сначала вызывается функция createPeer, которая создает новый объект RTCPeerConnection. Затем, для каждого трека из userStream, который представляет видео и/или аудио поток текущего пользователя, вызывается метод addTrack для добавления этого трека в новое соединение RTCPeerConnection.

  // Таким образом, функция callUser устанавливает соединение между двумя пользователями, которые могут начать передачу видео и аудио данных друг другу через этот соединение.
  function callUser(userID) {
    console.log("callUser");
    console.log(userStream.current);
    peerRef.current = createPeer(userID);

    userStream.current
      .getTracks()
      .forEach((track) => peerRef.current.addTrack(track, userStream.current));
  }

  function createPeer(userID) {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "stun:stun1.l.google.com:19302",
        },
        {
          urls: "stun:stun2.l.google.com:19302",
        },
        {
          urls: "turn:dj-front.doct24.com:3478",
          username: "99c5e73f64647ecb366442fb",
          credential: "EVtW7idU50NbcLcd",
        },
      ],
      iceCandidatePoolSize: 10,
      iceConnectionReceivingTimeout: 7000,
      iceConnectionRetryCount: 5,
    });

    //peer.onicecandidate устанавливает функцию handleICECandidateEvent в качестве обработчика события icecandidate. Это событие возникает, когда RTCIceCandidate генерируется объектом peer. Обработчик вызывается с аргументом event, который содержит информацию о сгенерированном RTCIceCandidate. Обработчик обычно отправляет RTCIceCandidate другому пиру по сети, чтобы оба пира могли установить соединение между собой.

    // peer.ontrack устанавливает функцию handleTrackEvent в качестве обработчика события track. Это событие возникает, когда новый MediaStreamTrack добавляется к RTCPeerConnection. Обработчик вызывается с аргументом event, который содержит информацию о добавленном MediaStreamTrack.

    // peer.onnegotiationneeded устанавливает функцию handleNegotiationNeededEvent в качестве обработчика события negotiationneeded. Это событие возникает, когда RTCPeerConnection нуждается в переговорах для установления или изменения соединения с другим пиром. Обработчик вызывается без аргументов и обычно запускает процесс переговоров, включающий генерацию локального оффера и отправку его другому пиру.

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
  }

  //   Этот код представляет собой обработчик события "NegotiationNeeded", который срабатывает во время установки соединения между двумя пировыми устройствами (peer-to-peer).

  // В функции выполняется следующее:

  // вызывается метод "createOffer" объекта "peerRef.current", чтобы создать новое предложение обмена данными между устройствами;
  // после успешного создания предложения, метод "setLocalDescription" устанавливает созданное предложение в качестве локального описания текущего устройства;
  // затем создается объект "payload", который содержит целевой идентификатор пользователя (userID), идентификатор вызывающего устройства (socketRef.current.id) и локальное описание устройства (peerRef.current.localDescription);
  // объект "payload" передается на сервер с помощью метода "emit" объекта "socketRef.current", событие "offer" и сам объект "payload".
  function handleNegotiationNeededEvent(userID) {
    console.log("handleNegotiationNeededEvent");

    peerRef.current
      .createOffer()
      .then((offer) => {
        return peerRef.current.setLocalDescription(offer);
      })
      .then(() => {
        const payload = {
          target: userID,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("offer", payload);
      })
      .catch((e) => console.log(e));
  }

  //   Когда функция handleRecieveCall вызывается, она получает параметр incoming, который содержит данные о входящем звонке, включая SDP (Session Description Protocol), который описывает параметры сеанса связи, такие как форматы медиа, кодеки и сетевые параметры.

  // Далее функция создает объект Peer с помощью createPeer() и сохраняет его в peerRef.current. Затем функция использует объект RTCSessionDescription для создания описания сеанса на основе SDP, который был получен от входящего звонка.

  // Затем функция использует setRemoteDescription() для установки удаленного описания сеанса на объекте Peer, и использует forEach() для добавления всех треков (видео, аудио и т.д.) в объект Peer из объекта MediaStream, который был сохранен в userStream.current.

  // Затем функция создает ответ на звонок с помощью createAnswer() и устанавливает локальное описание сеанса на объекте Peer с помощью setLocalDescription(). Затем функция генерирует и отправляет событие "answer" через веб-сокеты с параметрами, включающими локальное описание сеанса, ID вызывающего и получателя звонка.
  function handleRecieveCall(incoming) {
    console.log("handleRecieveCall");
    peerRef.current = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.current
      .setRemoteDescription(desc)
      .then(() => {
        userStream.current
          .getTracks()
          .forEach((track) =>
            peerRef.current.addTrack(track, userStream.current)
          );
      })
      .then(() => {
        return peerRef.current.createAnswer();
      })
      .then((answer) => {
        return peerRef.current.setLocalDescription(answer);
      })
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socketRef.current.id,
          sdp: peerRef.current.localDescription,
        };
        socketRef.current.emit("answer", payload);
      });
  }

  //   Этот код обрабатывает ответ на звонок, который был отправлен ранее с помощью функции handleRecieveCall().

  // Когда функция handleAnswer вызывается, она получает параметр message, который содержит данные ответа на звонок, включая SDP (Session Description Protocol), который описывает параметры сеанса связи, такие как форматы медиа, кодеки и сетевые параметры.

  // Затем функция использует объект RTCSessionDescription для создания описания сеанса на основе SDP, который был получен в ответе на звонок.

  // Затем функция использует setRemoteDescription() для установки удаленного описания сеанса на объекте Peer, который был создан ранее с помощью функции createPeer(). Это позволяет установить соединение между двумя браузерами и начать передачу медиа-данных и информации о сеансе связи.

  // Если в процессе установки удаленного описания сеанса возникает ошибка, функция использует метод catch() для ловли ошибки и вывода ее в консоль с помощью console.log().
  function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.current.setRemoteDescription(desc).catch((e) => console.log(e));
  }

  //   Эта функция обрабатывает события ICE (Interactive Connectivity Establishment) candidate, которые генерируются объектом Peer при установке соединения между двумя браузерами с помощью WebRTC.

  // Когда объект Peer генерирует событие icecandidate, функция handleICECandidateEvent вызывается. Если в событии присутствует кандидат ICE (e.candidate), то функция создает объект payload с параметрами, включающими кандидат ICE и целевой ID другого пользователя (то есть получателя звонка), сохраненный в otherUser.current. Затем функция отправляет объект payload через веб-сокеты с помощью метода emit() и события "ice-candidate".

  // Кандидаты ICE содержат информацию о доступных сетевых путях между браузерами, которые могут быть использованы для передачи медиа-данных и информации о сеансе связи. Они используются в процессе установки соединения между двумя браузерами, чтобы найти оптимальный путь для передачи данных.
  function handleICECandidateEvent(e) {
    if (e.candidate) {
      const payload = {
        target: otherUser.current,
        candidate: e.candidate,
      };
      socketRef.current.emit("ice-candidate", payload);
    }
  }

  //   Эта функция обрабатывает сообщения, содержащие кандидаты ICE, которые были отправлены с помощью веб-сокетов.

  // Когда функция handleNewICECandidateMsg вызывается, она получает параметр incoming, который содержит данные, включая кандидат ICE, отправленные от другого пользователя.

  // Затем функция использует объект RTCIceCandidate для создания объекта кандидата ICE на основе данных, которые были получены из сообщения.

  // Затем функция использует метод addIceCandidate() объекта Peer, созданного ранее с помощью функции createPeer(), для добавления кандидата ICE к локальной конфигурации ICE. Это позволяет установить связь между браузерами и настроить оптимальный путь для передачи медиа-данных и информации о сеансе связи.
  function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.current.addIceCandidate(candidate).catch((e) => console.log(e));
  }

  // Эта функция обрабатывает событие track, которое генерируется объектом RTCPeerConnection, когда новый медиапоток (stream) добавляется к объекту Peer.

  // Когда функция handleTrackEvent вызывается, она получает параметр e, который содержит информацию о медиапотоке (stream), который был добавлен к объекту Peer.

  // Затем функция использует свойство srcObject для установки медиапотока в видеоэлементе partnerVideo.current. Это позволяет отображать медиапоток, полученный от другого пользователя, на странице текущего пользователя.
  function handleTrackEvent(e) {
    partnerVideo.current.srcObject = e.streams[0];
  }

  return (
    <div>
      <video
        autoPlay
        playsInline
        ref={userVideo}
      />
      <video
        autoPlay
        playsInline
        ref={partnerVideo}
      />
    </div>
  );
};

export default Room;
