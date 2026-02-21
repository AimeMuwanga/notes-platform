// src/sender.js
import { ServiceBusClient } from "@azure/service-bus";

const sbClient = new ServiceBusClient(process.env.SB_CONN_STR);
const sender = sbClient.createSender("notes-events");

export async function publishEvent(event) {
    await sender.sendMessages({
        body: event,
        contentType: "application/json"
    });
}