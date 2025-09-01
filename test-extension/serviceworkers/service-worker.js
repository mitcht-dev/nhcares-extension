var tab_data = {};

chrome.webRequest.onCompleted.addListener(
    function(details) {
        if (details.initiator === "https://nhcares.alayacare.com") {
            let tab = details.tabId;

            if (details.url.startsWith("https://nhcares.alayacare.com/api/v1/scheduler/scheduled_visits")) {
                fetch(details.url)
                .then(response => response.json())
                .then(data => {
                    for (let i in data.items) {
                        fetch(`https://nhcares.alayacare.com/api/v2/patients/clients/${data.items[i].client.id}`)
                        .then(clientresponse => clientresponse.json())
                        .then(clientdata => {

                            let location;

                            if (clientdata.demographics.city === "Portland"){
                                let hasdirection = false;
                                let cardinals = [" N", " NE", " E", " SE", " S", " SW", " W", " NW"];
                                for (let str in cardinals){
                                    if (clientdata.demographics.address.includes(cardinals[str] + " ") || clientdata.demographics.address.includes(cardinals[str] + ". ")){
                                        location = cardinals[str] + " PDX";
                                        hasdirection = true;
                                        break;
                                    };
                                };
                                if (!hasdirection){
                                    location = "PDX";
                                };
                            } else {
                                location = clientdata.demographics.city;
                            };
                        
                            let visibletags;

                            if (clientdata.tags.includes("Male Caregiver")){
                                if (clientdata.tags.includes("Female Caregiver")){
                                    visibletags = "No CG Preference";
                                } else {
                                    visibletags = "Male CG Only";
                                };
                            } else if (clientdata.tags.includes("Female Caregiver")){
                                visibletags = "Female CG Only";
                            } else {
                                visibletags = "No CG Preference";
                            };

                            let vital = clientdata.tags.findIndex(element => element.includes("Vital"));
                            if (vital > -1){
                                visibletags += ", " + clientdata.tags[vital];
                            };

                            chrome.tabs.sendMessage(tab, [data.items[i].id, location, visibletags]);

                        })
                        .catch(clienterror => console.error("Error fetching client or sending data to content-script:", clienterror));
                    };
                })
                .catch(error => console.error("Error fetching visits:", error));
            }

            if (details.url.startsWith("https://nhcares.alayacare.com/api/v1/employees/")) {
                tab_data[details.tabId] = details.url;
                console.log(tab_data);
                fetch(details.url)
                .then(response => response.json())
                .then(employeeData => {
                    console.log("attempting to send employee data to content-script", employeeData);
                    chrome.tabs.sendMessage(tab, employeeData.groups.map(group => group.name).includes("Corporate") ? "Corporate" : employeeData.groups.map(group => group.name));
                })
            } else {
                console.log("other type of request");
                fetch(tab_data[details.tabId])
                .then(response => response.json())
                .then(employeeData => {
                    console.log("attempting to send employee data to content-script", employeeData);
                    chrome.tabs.sendMessage(tab, employeeData.groups.map(group => group.name).includes("Corporate") ? "Corporate" : employeeData.groups.map(group => group.name));
                })
            }
        }
    },
    { urls: [
        "https://nhcares.alayacare.com/*"
    ]}
);