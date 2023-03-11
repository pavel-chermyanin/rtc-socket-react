import { Route, Routes } from "react-router-dom";
import CreateRoom from "./routes/CreateRoom";
import Room from "./routes/Room";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path='/' element={<CreateRoom/>}/>
        <Route path='/room/:id' element={<Room/>}/>
      </Routes>
    </div>
  );
}

export default App;
