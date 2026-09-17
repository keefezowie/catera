import React from "react";
import { render } from "@testing-library/react-native";
let mockState = "failed";
const mockReload = jest.fn();
jest.mock("../src/context",()=>({
 useNative:()=>({actor:{id:"synthetic",role:"customer"},ready:true,demo:true,locale:"en",t:(_id:string,en:string)=>en,command:jest.fn()}),
 useData:()=>({data:{id:"checkout",state:mockState,subscription_id:["paid","refunded","partially_refunded"].includes(mockState)?"subscription":null,expires_at:new Date(Date.now()+600000).toISOString(),quote:{packageId:"package",offer:{name:"Synthetic meal"},portions:1,dates:["2026-10-01"],total:10000}},reload:mockReload}),
 nativeApi:{checkout:jest.fn()},apiBase:"http://localhost",
}));
jest.mock("expo-router",()=>({router:{push:jest.fn(),replace:jest.fn()},useLocalSearchParams:()=>({id:"checkout"}),useFocusEffect:(fn:()=>void)=>require("react").useEffect(fn,[])}));
jest.mock("@react-native-community/datetimepicker",()=>({__esModule:true,default:()=>null}));
jest.mock("@expo/vector-icons",()=>({Ionicons:()=>null}));
import { PaymentScreen } from "../src/purchase";
for (const [state,title] of [["failed","Payment failed"],["expired","Payment time expired"],["payment_exception","Your payment is being reviewed"],["refunded","Payment refunded"],["partially_refunded","Payment partially refunded"]]) test(`native ${state} never offers payment or claims success`,()=>{
 mockState=state;
 const screen=render(<PaymentScreen/>);
 expect(screen.getByText(title)).toBeTruthy();
 expect(screen.queryByText("Good meals are on the calendar.")).toBeNull();
 expect(screen.queryByText("Simulate successful payment")).toBeNull();
});
