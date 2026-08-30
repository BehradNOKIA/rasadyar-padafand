import {useAuth} from "./AuthProvider";
import Login from "./Login";


export default function ProtectedRoute(
{children}:any
){

const {user}=useAuth();


if(!user){

return <Login/>

}


return children;


}