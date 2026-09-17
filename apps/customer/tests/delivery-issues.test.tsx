import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
const mockCommand=jest.fn();
const mockIssue={id:"issue",day_id:"day",meal:"dinner",status:"resolved",version:3,case_id:null,package_name:"Synthetic dinner",service_date:"2026-10-01",subject:"Packaging",events:[{id:"event",body:"Seller response retained"}]};
jest.mock("../src/context",()=>({
 useNative:()=>({locale:"en",t:(_id:string,en:string)=>en,command:mockCommand}),
 useData:(key:string)=>({data:key.startsWith("issue-delivery:")?{deliveries:[{id:"day",offer:{name:"Synthetic dinner"},service_date:"2026-10-01",meals:[{meal:"dinner"}]}]}:[mockIssue],reload:jest.fn()}),
 nativeApi:{customer:jest.fn(),request:jest.fn()},
}));
jest.mock("expo-router",()=>({router:{push:jest.fn()}}));
jest.mock("@react-native-community/datetimepicker",()=>({__esModule:true,default:()=>null}));
jest.mock("@expo/vector-icons",()=>({Ionicons:()=>null}));
import { NativeDeliveryIssueReport, NativeDeliveryIssues } from "../src/delivery-issues";
beforeEach(()=>jest.clearAllMocks());
test("native report retains a failed draft, ties it to the purchased meal and waits for confirmation",async()=>{
 mockCommand.mockRejectedValueOnce(new Error("CONFLICT")).mockResolvedValueOnce({id:"issue"});
 const screen=render(<NativeDeliveryIssueReport id="day"/>);
 fireEvent.changeText(screen.getByLabelText("Tell us what happened"),"Synthetic damaged packaging");
 fireEvent.press(screen.getByText("Send report"));
 await waitFor(()=>expect(mockCommand).toHaveBeenCalledTimes(1));
 await waitFor(()=>expect(screen.getByText("Send report")).toBeTruthy());
 expect(screen.getByLabelText("Tell us what happened").props.value).toBe("Synthetic damaged packaging");
 expect(screen.queryByText("Report saved. Review responses below.")).toBeNull();
 fireEvent.press(screen.getByText("Send report"));
 await waitFor(()=>expect(screen.getByText("Report saved. Review responses below.")).toBeTruthy());
 expect(mockCommand).toHaveBeenLastCalledWith("deliveryIssue.create",{deliveryId:"day",meal:"dinner",subject:"Makanan belum diterima",body:"Synthetic damaged packaging"});
});
test("native customer can escalate a seller-resolved issue with its current version",async()=>{
 mockCommand.mockResolvedValue({id:"issue"});
 const screen=render(<NativeDeliveryIssues issue="issue"/>);
 expect(screen.getByText("Seller response retained")).toBeTruthy();
 fireEvent.press(screen.getByText("Ask Catera to review"));
 fireEvent.changeText(screen.getByLabelText("Escalation reason"),"Synthetic unresolved problem");
 fireEvent.press(screen.getByText("Escalate to Catera"));
 await waitFor(()=>expect(mockCommand).toHaveBeenCalledWith("deliveryIssue.escalate",{id:"issue",version:3,body:"Synthetic unresolved problem"}));
});
