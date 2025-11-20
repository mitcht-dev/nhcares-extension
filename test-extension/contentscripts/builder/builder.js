console.log("Builder content script initialized");

//remove custom html if leaving builder page
window.addEventListener("hashchange", function() {
    if (window.location.hash === "#/builder") {
        console.log("Loading builder page");
        onBuilderPageLoad();
    } else {
        const customContent = document.getElementById("custom-div");
        if (customContent) {
            console.log("Removing custom content");
            customContent.remove();
        };
    };
});

//add custom sidebar button when page loaded
document.addEventListener("DOMContentLoaded", function() {
    console.log("DOM loaded");
    const domObserver = new MutationObserver((_mutationList, observer) => {
        const sideNav = document.querySelector("div.sideNav");
        
        if (sideNav) {
            observer.disconnect();
            console.log("Sidenav loaded, DOM listener deactivated");
            const btn = document.createElement("li");
            //btn.setAttribute("data-v-52b1fb15", true);
            btn.setAttribute("data-v-0f4f329d", true);
            btn.setAttribute("data-acl", "schedule/admin");
            sideNav.firstElementChild.appendChild(btn);
    
            const link = document.createElement("a");
            link.setAttribute("data-v-024a2701", true);
            //link.setAttribute("data-v-52b1fb15", true);
            link.setAttribute("data-v-0f4f329d", true);
            link.setAttribute("href", "#/builder");
            btn.appendChild(link);
    
            const img = document.createElement("i");
            //img.setAttribute("data-v-52b1fb15", true);
            img.setAttribute("data-v-0f4f329d", true);
            img.setAttribute("class", "ph-calendar-blank");
            link.appendChild(img);
    
            const title = document.createElement("span");
            //title.setAttribute("data-v-52b1fb15", true);
            title.setAttribute("data-v-0f4f329d", true);
            title.innerText = "WIP";
            link.appendChild(title);
        };
    });
    
    domObserver.observe(document.body, { childList: true, subtree: true });
    console.log("DOM listening for sidenav");

    if (window.location.hash === "#/builder") {
        console.log("Loading builder page");
        onBuilderPageLoad();
    };
});

//builds the custom page when navigating to builder page
function onBuilderPageLoad() {
    const elementObserver = new MutationObserver((_mutationList, observer) => {
        const element = document.querySelector(".page-not-found");
        if (element && window.location.hash === "#/builder") {
            observer.disconnect();
            element.remove();

            //fetch prebuilt html and attach to body
            fetch(chrome.runtime.getURL("contentscripts/builder/builder.html"))
                .then(response => response.text())
                .then(html => {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, "text/html");
                    const importedContent = doc.body.firstChild;
                    document.body.appendChild(importedContent);

                    //set css attributes of some elements
                    const form = document.getElementById("time-inputs-form");
                    form.addEventListener("submit", function(event) {
                        event.preventDefault();
                        GenerateDataTable(new FormData(form));
                    });

                    const customContent = document.getElementById("custom-div");
                    customContent.style.marginLeft = document.getElementById("sidebar").offsetWidth + "px";
                    customContent.style.width = "calc(100% - " + document.getElementById("sidebar").offsetWidth + "px)";
                })
                .catch(error => console.error("Error loading builder.html:", error));
        };
    });

    elementObserver.observe(document.body, { childList: true, subtree: true });
};

function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
  
    hours = hours % 12;
    hours = hours ? hours : 12;
  
    if (minutes === 0) {
      return `${hours} ${ampm}`;
    } else {
      return `${hours}:${minutes < 10 ? '0' + minutes : minutes} ${ampm}`;
    }
};
/*
async function submitForm(data) {
    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;

    //transform form data to object
    const inputs = Object.fromEntries(data);

    //REMOVE LATER
    console.log(inputs['caregiver-preference']);

    const start = new Date();
    const end = new Date();
    start.setDate(start.getDate() + 28);
    end.setDate(end.getDate() + 34);

    const startmonth = (start.getMonth() + 1).toString().padStart(2, "0");
    const startday = start.getDate().toString().padStart(2, "0");
    const endmonth = (end.getMonth() + 1).toString().padStart(2, "0");
    const endday = (end.getDate() + 1).toString().padStart(2, "0");

    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const promises = [];

    //fetch visits within specified times for each weekday included
    days.forEach(day => {
        if (inputs[`${day}-begin-time`] && inputs[`${day}-end-time`]) {
            const [starthour, startminute] = inputs[`${day}-begin-time`].split(":");
            const [endhour, endminute] = inputs[`${day}-end-time`].split(":");

            const url = `https://nhcares.alayacare.com/api/v1/scheduler/scheduled_visits?1=1&day_of_week=${day}&visit_status=vacant&visit_status=offered&client_group_ids=${inputs["group"]}&count=999&page=1&sort_by=start_date&sort_order=asc&time_zone=America%2FVancouver&start_date_from=${start.getFullYear()}-${startmonth}-${startday}T07%3A00%3A00.000Z&start_date_to=${end.getFullYear()}-${endmonth}-${endday}T06%3A59%3A59.999Z&start_time_from=${starthour}%3A${startminute}&end_time_to=${endhour}%3A${endminute}&is_recurrence=true`;

            promises.push(fetch(url).then(response => response.json()));
        }
    });

    const results = await Promise.all(promises);
    //search each client info
    var clientLookups = [...new Set(results.flatMap(search => search.items.map(shift => shift.client.id)))].map(clientId => fetch('https://nhcares.alayacare.com/ext/api/v2/patients/clients/'+clientId).then(response => response.json()));
    const clientLookupsResults = await Promise.all(clientLookups);
    var rowEntries = [];
    //define entry for each client
    clientLookupsResults.forEach(client => {
        let pref = [];
        if (client.tags.includes("Male Caregiver")) {pref.push("M")}
        else {pref.push("F");}
        if (client.tags.includes("Female Caregiver")) {pref.push("F")}
        else {pref.push("M");}

        rowEntries.push({
            id: client.id,
            hours: 0,
            name: client.demographics.first_name + " " + client.demographics.last_name,
            shifts: {sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: []},
            city: client.demographics.city,
            gender: client.demographics.gender,
            preference: pref
        });
    });

    results.forEach(data => {
        data.items.forEach(item => {
            entry = rowEntries.find(entry => entry.id === item.client.id);
            const duration = ((item.end_at - item.start_at) / 3600);
            const dateStart = new Date(item.start_at * 1000);
            const dateEnd = new Date(item.end_at * 1000);
            const isNOC = dateStart.getDate() === dateEnd.getDate() ? false : true;
            const dayOfWeek = days[dateStart.getDay()];
            var starttime = new Date(item.start_at * 1000);
            starttime = formatTime(starttime);
            var endtime = new Date(item.end_at * 1000);
            endtime = formatTime(endtime);
            entry.hours += duration;
            entry.shifts[dayOfWeek].push({Beginning: starttime, Ending: endtime, NOC: isNOC, Length: duration});
        });
    });

    displayResults(rowEntries);
}

//using rowEntries, display results in table based on filters
function displayResults(rowEntries) {
    
    const resultsTableBody = document.getElementById("results-table-body");
    resultsTableBody.querySelectorAll("tr").forEach(row => row.remove());
    
    rowEntries = rowEntries.filter(entry => entry.hours > 0);
    rowEntries.sort((a, b) => b.hours - a.hours);

    //populate results table
    rowEntries.forEach(entry => {
        const row = document.createElement("tr");

        const hoursCell = document.createElement("td");
        hoursCell.innerText = entry.hours.toString().substring(0, 4);
        row.appendChild(hoursCell);

        const nameCell = document.createElement("td");
        const nameLink = document.createElement("a");
        nameLink.setAttribute("href", `https://nhcares.alayacare.com/#/clients/${entry.id.toString(36)}/overview`);
        nameLink.setAttribute("target", `_blank`);
        nameLink.innerText = entry.name;
        nameCell.appendChild(nameLink);
        row.appendChild(nameCell);

        const cityCell = document.createElement("td");
        cityCell.innerText = entry.city;
        row.appendChild(cityCell);

        //for each day of the week, add a cell with the shifts
        Object.keys(entry.shifts).forEach(key => {
            const shiftCell = document.createElement("td");

            entry.shifts[key].forEach((shift, index) => {
                const shiftDiv = document.createElement("div");
                shiftDiv.style.padding = "10px";
                shiftDiv.innerText = `${shift.Beginning} - ${shift.Ending}`;
                
                if (index < entry.shifts[key].length - 1) {
                    shiftDiv.style.borderBottom = "2px dotted gray";
                }
                
                shiftCell.appendChild(shiftDiv);
            });
            shiftCell.style.border = "2px solid gray";
            shiftCell.style.borderLeft = "3px solid gray";
            row.appendChild(shiftCell);
        });

        [hoursCell, nameCell, cityCell].forEach(cell => {
            cell.style.border = "2px solid gray";
            cell.style.borderLeft = "3px solid gray";
            cell.style.textAlign = "center";
            cell.style.padding = "10px";
        });

        resultsTableBody.appendChild(row);
    });

    submitButton.disabled = false;
}
    */

const weekDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

var rawEntries = [];

async function GenerateDataTable(formData) {
    rawEntries = [];
    console.log("Raw entries cleared");
    console.log("Generating table");
    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = true;
    console.log("Button disabled");

    //transform form data to object
    const inputs = Object.fromEntries(formData);

    //REMOVE LATER
    console.log("Inputs: ", inputs);

    const start = new Date();
    const end = new Date();
    start.setDate(start.getDate() + 28);
    end.setDate(end.getDate() + 34);

    const startmonth = (start.getMonth() + 1).toString().padStart(2, "0");
    const startday = start.getDate().toString().padStart(2, "0");
    const endmonth = (end.getMonth() + 1).toString().padStart(2, "0");
    const endday = (end.getDate() + 1).toString().padStart(2, "0");
    const promises = [];

    //fetch visits within specified times for each weekday included
    weekDays.forEach(day => {
        if (inputs[`${day}-begin-time`] && inputs[`${day}-end-time`]) {
            const [starthour, startminute] = inputs[`${day}-begin-time`].split(":");
            const [endhour, endminute] = inputs[`${day}-end-time`].split(":");

            const url = `https://nhcares.alayacare.com/api/v1/scheduler/scheduled_visits?1=1&day_of_week=${day}&visit_status=vacant&visit_status=offered&client_group_ids=${inputs["group"]}&count=999&page=1&sort_by=start_date&sort_order=asc&time_zone=America%2FVancouver&start_date_from=${start.getFullYear()}-${startmonth}-${startday}T07%3A00%3A00.000Z&start_date_to=${end.getFullYear()}-${endmonth}-${endday}T06%3A59%3A59.999Z&start_time_from=${starthour}%3A${startminute}&end_time_to=${endhour}%3A${endminute}&is_recurrence=true`;

            promises.push(fetch(url).then(response => response.json()));
        }
    });

    console.log("Searching visits");
    const results = await Promise.all(promises);
    console.log("Search completed");
    //search each client info
    var clientLookups = [...new Set(results.flatMap(search => search.items.map(shift => shift.client.id)))].map(clientId => fetch('https://nhcares.alayacare.com/ext/api/v2/patients/clients/'+clientId).then(response => response.json()));
    console.log("Searching clients");
    const clientLookupsResults = await Promise.all(clientLookups);
    console.log("Search completed");
    //define entry for each client
    clientLookupsResults.forEach(client => {
        let pref = [];
        if (client.tags.includes("Male Caregiver")) {pref.push("M")}
        else {pref.push("F");}
        if (client.tags.includes("Female Caregiver")) {pref.push("F")}
        else {pref.push("M");}

        rawEntries.push({
            display: true,
            id: client.id,
            hours: 0,
            name: client.demographics.first_name + " " + client.demographics.last_name,
            shifts: {sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: []},
            city: client.demographics.city,
            gender: client.demographics.gender,
            caregiverRestriction: pref
        });
    });
    console.log("Clients pushed to entries");

    results.forEach(data => {
        data.items.forEach(item => {
            entry = rawEntries.find(entry => entry.id === item.client.id);
            const duration = ((item.end_at - item.start_at) / 3600);
            const dateStart = new Date(item.start_at * 1000);
            const dateEnd = new Date(item.end_at * 1000);
            const isNOC = dateStart.getDate() === dateEnd.getDate() ? false : true;
            const dayOfWeek = weekDays[dateStart.getDay()];
            var starttime = new Date(item.start_at * 1000);
            starttime = formatTime(starttime);
            var endtime = new Date(item.end_at * 1000);
            endtime = formatTime(endtime);
            //entry.hours += duration;
            entry.shifts[dayOfWeek].push({Beginning: starttime, Ending: endtime, NOC: isNOC, Length: duration, Display: true});
        });
    });
    console.log("Shifts pushed to client entries");
    console.log("Raw Entries: ", rawEntries);

    DisplayDataTable(inputs);
}

//using rowEntries, display results in table based on filters
function DisplayDataTable(inputs) {

    //APPLY FILTERS HERE
    //filter by employee and client gender restrictions
    
    var displayEntries = rawEntries.filter(entry => {
        entry.caregiverRestriction.includes(inputs['caregiver-restriction'])
        && entry.gender === inputs['client-restriction']
    });
    console.log("Generated display entries: ", displayEntries);

    /*rawEntries.forEach(entry => {
        console.log(entry.caregiverRestriction, inputs['caregiver-restriction'], entry.caregiverRestriction.includes(inputs['caregiver-restriction']));
        console.log(entry.gender, inputs['client-restriction'], entry.gender === inputs['client-restriction']);
    });*/

    //filter by city maybe??
    
    //filter NOC
    displayEntries.forEach(entry => {
        Object.keys(entry.shifts).forEach(weekday => {
            entry.shifts[weekday].forEach(shift => {
                if ((shift.NOC && inputs['include-NOC']) || !shift.NOC) {
                    entry.hours += shift.Length;
                } else {
                    shift.Display = false;
                }
            });
        });
    });
    console.log("Calculated hours");
    
    //filter out 0 hour entries
    displayEntries = displayEntries.filter(entry => entry.hours > 0);
    console.log("Removed entries with 0 hours");

    displayEntries.sort((a, b) => b.hours - a.hours);
    console.log("Entries sorted");
    console.log(displayEntries);
    
    
    const resultsTableBody = document.getElementById("results-table-body");
    resultsTableBody.querySelectorAll("tr").forEach(row => row.remove());
    console.log("Removed old displayed entries");

    //populate results table
    displayEntries.forEach(entry => {
        const row = document.createElement("tr");

        const hoursCell = document.createElement("td");
        hoursCell.innerText = entry.hours.toString().substring(0, 4);
        row.appendChild(hoursCell);

        const nameCell = document.createElement("td");
        const nameLink = document.createElement("a");
        nameLink.setAttribute("href", `https://nhcares.alayacare.com/#/clients/${entry.id.toString(36)}/overview`);
        nameLink.setAttribute("target", `_blank`);
        nameLink.innerText = entry.name;
        nameCell.appendChild(nameLink);
        row.appendChild(nameCell);

        const cityCell = document.createElement("td");
        cityCell.innerText = entry.city;
        row.appendChild(cityCell);

        //for each day of the week, add a cell with the shifts
        Object.keys(entry.shifts).forEach(weekday => {
            const shiftCell = document.createElement("td");

            entry.shifts[weekday].forEach((shift, index) => {
                const shiftDiv = document.createElement("div");
                shiftDiv.style.padding = "10px";
                shiftDiv.innerText = `${shift.Beginning} - ${shift.Ending}`;
                
                if (index < entry.shifts[shift].length - 1) {
                    shiftDiv.style.borderBottom = "2px dotted gray";
                }
                
                shiftCell.appendChild(shiftDiv);
            });
            shiftCell.style.border = "2px solid gray";
            shiftCell.style.borderLeft = "3px solid gray";
            row.appendChild(shiftCell);
        });

        [hoursCell, nameCell, cityCell].forEach(cell => {
            cell.style.border = "2px solid gray";
            cell.style.borderLeft = "3px solid gray";
            cell.style.textAlign = "center";
            cell.style.padding = "10px";
        });

        resultsTableBody.appendChild(row);
    });
    console.log("Entries displayed");

    const submitButton = document.getElementById("submit-button");
    submitButton.disabled = false;
    console.log("Button reenabled");
    console.log("Table display complete");
}