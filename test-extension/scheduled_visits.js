// Scheduled Visits Module
// Adds Tags and Client City columns to the scheduled visits table

// Prevent multiple executions
if (!window.ScheduledVisitsLoaded) {
  window.ScheduledVisitsLoaded = true;

  (function () {
    'use strict';

    // Hoisted
    const originalFetch = window.fetch;

    class ScheduledVisitsViewManager {
      constructor() {
        // Data store
        this.visitMap = {};
        this.clientMap = {};

        // Mutation Observer
        this.tableObserver = null;

        // Filter State
        this.activeSelectors = null;
        this.activeCustomElements = null;
        this.activeColumns = null;

        // Vue dynamic value
        this.dataV = null;

        // DOM Table Element locators
        this.DYNAMIC_SELECTORS = {
          NEW: {
            TABLE: 'table[role="table"].p-datatable-table',
            TH_ROW: 'thead[role="rowgroup"].p-datatable-thead',
            TH_CELL: 'th[role="cell"]',
            BODY: 'tbody[role="rowgroup"].p-datatable-tbody',
            ROW: 'tr[role="row"]',
            CELL: 'td[role="cell"]',
          },
          LEGACY: {
            TABLE: 'table#datatable',
            TH_ROW: 'thead',
            TH_CELL: 'th',
            BODY: 'tbody',
            ROW: 'tr',
            CELL: 'td',
          },
        };

        this.STATIC_SELECTORS = {
          VISIT_LINK: '.visit_link',
          CLIENT_LINK: 'a[href*="/clients/"]',
        };

        // Method for creating elements based on table type
        this.CUSTOM_ELEMENTS = {
          NEW: {
            HEADER: (title, identifier) => {
              const th = document.createElement('th');
              th.setAttribute('role', 'cell');
              // Custom identifer
              th.classList.add(`${identifier}`);
              th.style.minWidth = '5rem';

              const div = document.createElement('div');
              div.classList.add('p-column-header-content')
              th.appendChild(div);

              const span = document.createElement('span');
              span.classList.add('p-column-title')
              span.textContent = title;
              div.appendChild(span);

              return th;
            },
            CELL: (text, identifier) => {
              const td = document.createElement('td');
              // Custom identifer
              td.classList.add(`${identifier}`);
              td.setAttribute('role', 'cell');
              td.style.minWidth = '10rem';
              td.textContent = text;

              return td;
            },
          },
          LEGACY: {
            HEADER: (title, identifier) => {
              const th = document.createElement('th');
              th.classList.add(`datatable-column___${identifier}`)
              // Custom identifer
              th.classList.add(`${identifier}`);
              // Vue value
              th.setAttribute(this.dataV, '');
              th.style.width = '5%';

              const div = document.createElement('div');
              div.classList.add('column-contents')
              div.style.position = 'relative';
              div.textContent = title;
              th.appendChild(div);

              return th;
            },
            CELL: (text, identifier) => {
              const td = document.createElement('td');
              td.classList.add(`datatable-column___${identifier}`)
              // Custom identifer
              td.classList.add(`${identifier}`);
              // Vue value
              td.setAttribute(this.dataV, '');
              td.style.height = '40px';

              const span1 = document.createElement('span');
              td.appendChild(span1);

              const span2 = document.createElement('span');
              span2.classList.add('break-line')
              span2.textContent = text;
              span1.appendChild(span2);

              return td;
            },
          },
        };

        // Logic for creating custom data columns
        this.CUSTOM_COLUMNS = {
          'Client Tags': {
            identifier: 'client-tags',
            getContent: (clientData) => {
              const tags = clientData.client.tags_v2 || clientData.client.tags;
              if (!tags?.length) {
                return 'No CG Preference';
              }

              const tagNames = tags.map(tag => tag.name || tag);

              // Check for Female Caregiver and Male Caregiver
              const allowsFemaleCaregiver = tagNames.some(name => name === 'Female Caregiver');
              const allowsMaleCaregiver = tagNames.some(name => name === 'Male Caregiver');

              // If both exist or neither exist, show "No CG Preference"
              const caregiverPreference = allowsFemaleCaregiver === allowsMaleCaregiver
                ? 'No CG Preference'
                : (allowsFemaleCaregiver ? 'Female CG Only' : 'Male CG Only');

              // Filter tags that start with "Vital"
              const vitalTags = tagNames.filter(name => name.startsWith('Vital'));

              // Combine caregiver preference with vital tags
              const filteredTags = [caregiverPreference, ...vitalTags];

              return filteredTags.join(', ');
            },
          },
          'Client City': {
            identifier: 'client-city',
            getContent: (clientData) => {
              let content = clientData.client.demographics.city || '<span style="color:#ccc">--</span>';

              if (String(content).toLowerCase().includes('portland')) {
                const cardinals = [' N ', ' NE ', ' E ', ' SE ', ' S ', ' SW ', ' W ', ' NW '];
                for (const cardinal of cardinals) {
                  if (clientData.client.demographics.address.includes(cardinal)) {
                    content = cardinal + ' ' + content;
                  }
                }
              }
              
              return content;
            },
          },
          'Client Careplan': {
            identifier: 'client-careplan',
            getContent: (clientData) => {
              const CLI = clientData.careplan.diagnoses.find(diagnose => diagnose.name.toLowerCase() === 'client centered information')?.description || 'Error';
              return CLI;
            },
          },
        };

        this.ENDPOINTS = {
          SCHEDULED_VISITS: '/api/v1/scheduler/scheduled_visits',
          GET_CLIENT_BY_ID: (clientId) => `/ext/api/v2/patients/clients/${clientId}`,
          GET_ACTIVE_CAREPLAN: (clientId) => `/ext/api/v2/clinical/client/${clientId}/careplans?status=active`,
          GET_ACTIVE_CAREPLAN_DETAILS: (careplanId) => `/api/v1/clinical/careplan/${careplanId}`
        };

        /** TESTING COLUMN OPTIONS */
        this.COLUMNS = {
          NEW: {
            'Client City': true,
            'Client Tags': true,
            'Visit ID': true,
            'Client': true,
            'Client-Address-Icon': true,
            'Service Instructions': false,
            'Employee': false,
            'Employee-Icon': false,
            'Facility': false,
            'Service Code': true,
            'Start Date': true,
            'Start Time': true,
            'End Time': true,
            'Duration': true,
            'ERL Code': false,
            'Approval Status': false,
            'Visit Status': false,
          },
          LEGACY: {
            'Client City': true,
            'Client Tags': true,
            'Visit ID': true,
            'Client': true,
            'Employee': false,
            'Facility': false,
            'Service Code': true,
            'Start Date': true,
            'Start Time': true,
            'End Time': true,
            'Duration': true,
            'Approval Status': false,
            'Visit Status': false,
          },
        };

        // Activate
        this.init();
      }

      init() {
        // Augment fetch and XML requests
        this.injectNetworking();
        // Determine selectors and watch for table changes
        this.observePage();
      }

      injectNetworking() {
        window.fetch = (...args) => {

          if (!this.isScheduledVisitsPage()) return originalFetch.apply(window, args);

          const url = args[0];

          if (typeof url === 'string' && url.includes(this.ENDPOINTS.SCHEDULED_VISITS)) {
            return originalFetch.apply(window, args).then(response => {
              const clonedResponse = response.clone();

              clonedResponse.json().then(data => {
                this.processVisitData(data);
              }).catch((err) => {
                console.error('[Vibe Extension - Visits] Error processing data:', err);
              });

              return response;
            });
          }

          return originalFetch.apply(window, args);
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
          this._url = url;
          return originalOpen.apply(this, arguments);
        };

        // Capture class instance
        const self = this;

        XMLHttpRequest.prototype.send = function () {
          if (this._url?.includes(self.ENDPOINTS.SCHEDULED_VISITS)) {
            this.addEventListener('load', function () {
              if (this.status === 200) {
                try {
                  let data;

                  // Handle different response types
                  if (this.responseType === 'blob' || this.responseType === '') {
                    if (this.response instanceof Blob) {
                      // Convert blob to text then parse
                      const reader = new FileReader();
                      reader.onload = function () {
                        try {
                          const data = JSON.parse(reader.result);
                          self.processVisitData(data);
                        } catch (err) {
                          console.error('[Vibe Extension - Visits] Error parsing blob:', err);
                        }
                      };
                      reader.readAsText(this.response);
                    } else if (this.responseText) {
                      data = JSON.parse(this.responseText);
                      self.processVisitData(data);
                    }
                  } else if (this.responseType === 'json') {
                    data = this.response;
                    self.processVisitData(data);
                  } else if (this.responseText) {
                    data = JSON.parse(this.responseText);
                    self.processVisitData(data);
                  }
                } catch (err) {
                  console.error('[Vibe Extension - Visits] Error processing XHR response:', err);
                }
              }
            });
          }

          return originalSend.apply(this, arguments);
        };
      }

      processVisitData(data) {
        if (!data?.items || !Array.isArray(data.items)) return;

        data.items.forEach(visit => {

          const visitId = visit.id || null;
          const clientId = visit.client.id || visit.client_id || null;
          
          this.fetchClientInfo(visitId, clientId);
        });
      }

      // Function to fetch client tags and city for a specific client
      async fetchClientInfo(visitId, clientId) {
        this.clientMap[clientId] = {};

        // Fetch client profile info
        try {
          const response = await originalFetch(this.ENDPOINTS.GET_CLIENT_BY_ID(clientId));

          if (response.ok) {
            const clientData = await response.json();
            this.clientMap[clientId].client = clientData;
          }
        } catch (err) {
          console.error('[Vibe Extension - Visits] Error fetching client data:', err);
        }

        // Fetch client's active careplan
        try {
          const response = await originalFetch(this.ENDPOINTS.GET_ACTIVE_CAREPLAN(clientId));

          if (response.ok) {
            const careplans = await response.json();
            if (!careplans.count) return;
            const careplan = careplans.items[0];

            // Fetch details of active careplan
            try {
              const response = await originalFetch(this.ENDPOINTS.GET_ACTIVE_CAREPLAN_DETAILS(careplan.id));

              if (response.ok) {
                const careplanDetails = await response.json();

                this.clientMap[clientId].careplan = careplanDetails;
                
                // Update dataMap
                this.visitMap[visitId] = this.clientMap[clientId];

                // Update row
                this.updateRow(visitId);
              }
            } catch (err) {
              console.error('[Vibe Extension - Visits] Error fetching careplan details:', err);
            }
          }
        } catch (err) {
          console.error('[Vibe Extension - Visits] Error fetching careplans:', err);
        }
      }

      updateRow(visitId) {
        const allRows = document.querySelectorAll(`${this.activeSelectors.BODY} > ${this.activeSelectors.ROW}`);

        const rowElement = Array.from(allRows).find(r => {
          const link = r.querySelector(this.STATIC_SELECTORS.VISIT_LINK);
          return link && link.textContent.trim() === String(visitId);
        });

        if (!rowElement) return;

        const clientInfo = this.visitMap[visitId];

        for (const columnName in this.CUSTOM_COLUMNS) {
          const content = this.CUSTOM_COLUMNS[columnName].getContent(clientInfo);
          const identifier = this.CUSTOM_COLUMNS[columnName].identifier;

          this.upsertCell(rowElement, content, identifier);
        }

        // Hide disabled columns
        const cells = Array.from(rowElement.querySelectorAll(this.activeSelectors.CELL));
        Object.keys(this.activeColumns).forEach((columnName, index) => {
          if (!this.activeColumns[columnName]) {
            cells[index].style.display = 'none';
          }
        });
      }

      // Check if page is displaying New or Legacy table
      determineSelectors() {
        if (document.querySelector(this.DYNAMIC_SELECTORS.NEW.TABLE)) {
          this.activeSelectors = this.DYNAMIC_SELECTORS.NEW;
          this.activeCustomElements = this.CUSTOM_ELEMENTS.NEW;
          this.activeColumns = this.COLUMNS.NEW;

          return true;

        } else if (document.querySelector(this.DYNAMIC_SELECTORS.LEGACY.TABLE)) {
          this.activeSelectors = this.DYNAMIC_SELECTORS.LEGACY;
          this.activeCustomElements = this.CUSTOM_ELEMENTS.LEGACY;
          this.activeColumns = this.COLUMNS.LEGACY;

          // Set Vue value
          const table = document.querySelector(this.activeSelectors.TABLE);
          const th = table.querySelector(this.activeSelectors.TH_CELL);
          this.dataV = Array.from(th.attributes).find(attribute => attribute.name.startsWith('data-v-')).name;

          return true;
        }

        // No table located
        return false;
      }

      observePage() {
        setInterval(() => {
          if (!this.isScheduledVisitsPage()) {
            return;
          };

          const ready = this.determineSelectors();

          if (ready) {
            const table = document.querySelector(this.activeSelectors.TABLE);
            if (table) {
              this.insertHeaders();
              if (!this.tableObserver) this.initializeTableObserver(table);
            }
          }
        }, 2000);
      }

      insertHeaders() {
        const theadRow = document.querySelector(`${this.activeSelectors.TH_ROW} > ${this.activeSelectors.ROW}`);
        if (!theadRow) return;

        for (const columnName in this.CUSTOM_COLUMNS) {
          const identifier = this.CUSTOM_COLUMNS[columnName].identifier;
          if (!theadRow.querySelector(`.${identifier}`)) {
            const header = this.activeCustomElements.HEADER(columnName, identifier);
            theadRow.insertBefore(header, theadRow.firstChild);
          }
        }
        
        // Hide disabled columns
        const headers = Array.from(theadRow.querySelectorAll(this.activeSelectors.TH_CELL));
        Object.keys(this.activeColumns).forEach((columnName, index) => {
          if (!this.activeColumns[columnName]) {
            headers[index].style.display = 'none';
          }
        });
      }

      initializeTableObserver(table) {
        if (this.tableObserver) this.tableObserver.disconnect();

        const tbody = table.querySelector(this.activeSelectors.BODY);
        if (!tbody) return;

        this.tableObserver = new MutationObserver(mutations => {
          let shouldRender = false;
          mutations.forEach(m => {
            if (m.addedNodes.length) shouldRender = true;
          });
          if (shouldRender) {
            this.insertHeaders();
            this.updateAllRows();
          }
        });

        this.tableObserver.observe(tbody, { childList: true, subtree: false });
      }

      updateAllRows() {
        Object.keys(this.visitMap).forEach(visit => {
          this.updateRow(visit);
        });
      }

      upsertCell(row, content, identifier) {
        let cell = row.querySelector(`.${identifier}`);
        if (!cell) {
            cell = this.activeCustomElements.CELL(content, identifier);
            row.insertBefore(cell, row.firstChild);
        }
      }

      // Function to check if URL is the scheduled visits page
      isScheduledVisitsPage() {
        return window.location.href.includes('scheduling/scheduled-visits');
      }
    }

    window.vibeScheduledVisits = new ScheduledVisitsViewManager();
  })();
}
