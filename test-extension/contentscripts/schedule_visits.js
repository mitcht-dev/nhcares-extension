// Scheduled Visits Module
// Adds Tags and Client City columns to the scheduled visits table

// Prevent multiple executions
if (!window.vibeScheduledVisitsLoaded) {
  window.vibeScheduledVisitsLoaded = true;

  (function () {
    'use strict';

    // Store visit data from API
    let visitData = {};

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const url = args[0];

      if (typeof url === 'string' && url.includes('/api/v1/scheduler/scheduled_visits')) {
        return originalFetch.apply(this, args).then(response => {
          const clonedResponse = response.clone();

          clonedResponse.json().then(data => {
            if (data?.items && Array.isArray(data.items)) {
              visitData = {};

              data.items.forEach(visit => {
                if (visit.id) {
                  visitData[visit.id] = {
                    tags: visit.tags || [],
                    client_city: '',
                    client_id: visit.client_id || visit.client?.id || null
                  };
                }
              });

              // Fetch client tags and city for each visit individually
              Object.keys(visitData).forEach(visitId => {
                const clientId = visitData[visitId].client_id;
                if (clientId) {
                  fetchClientTags(visitId, clientId);
                }
              });

              // Update columns with new data
              setTimeout(() => {
                if (isScheduledVisitsPage()) {
                  updateVisitColumns();
                  observeTableForRows();
                }
              }, 1000);
            }
          }).catch((err) => {
            console.error('[Vibe Extension - Visits] Error processing data:', err);
          });

          return response;
        });
      }

      return originalFetch.apply(this, args);
    };

    // Function to fetch client tags and city for a specific client
    async function fetchClientTags(visitId, clientId) {
      if (!visitData[visitId] || !clientId) {
        return;
      }

      try {
        const response = await originalFetch(`/ext/api/v2/patients/clients/${clientId}`);

        if (response.ok) {
          const clientData = await response.json();

          if (visitData[visitId]) {
            visitData[visitId].clientTags = clientData.tags || [];
            visitData[visitId].client_city = clientData.demographics?.city || '';

            setTimeout(() => {
              updateTagsCell(visitId, clientData.tags || []);
              updateRowWithCity(visitId, visitData[visitId].client_city);
            }, 100);
          }
        }
      } catch (err) {
        console.error('[Vibe Extension - Visits] Error fetching client data:', err);
      }
    }

    // Function to filter and format tags based on business logic
    function filterAndFormatTags(tags) {
      if (!tags?.length) {
        return 'No CG Preference';
      }

      const tagNames = tags.map(tag => tag.name || tag);

      // Check for Female Caregiver and Male Caregiver
      const hasFemaleCaregiver = tagNames.some(name => name === 'Female Caregiver');
      const hasMaleCaregiver = tagNames.some(name => name === 'Male Caregiver');

      // If both exist or neither exist, show "No CG Preference"
      const caregiverPreference = (hasFemaleCaregiver && hasMaleCaregiver) || (!hasFemaleCaregiver && !hasMaleCaregiver)
        ? 'No CG Preference'
        : (hasFemaleCaregiver ? 'Female CG Only' : 'Male CG Only');

      // Filter tags that start with "Vital"
      const vitalTags = tagNames.filter(name => name.startsWith('Vital'));

      // Combine caregiver preference with vital tags
      const filteredTags = [caregiverPreference, ...vitalTags];

      return filteredTags.join(', ');
    }

    // Function to update Tags cell for a specific visit
    function updateTagsCell(visitId, tags) {
      const table = document.querySelector('table[role="table"].p-datatable-table');
      if (!table) return;

      const tbody = table.querySelector('tbody[role="rowgroup"].p-datatable-tbody');
      if (!tbody) return;

      // Find the row by visit_link
      const allRows = tbody.querySelectorAll('tr[role="row"]');
      let row = null;

      allRows.forEach(r => {
        const visitLink = r.querySelector('a.visit_link');
        if (visitLink?.textContent.trim() === String(visitId)) {
          row = r;
        }
      });

      if (!row) return;

      // Try to find Tags cell directly by data-test attribute first
      let tagsCell = row.querySelector('td[data-test="data-table-column-tags"]');

      // If not found, try to find by matching column index
      if (!tagsCell) {
        const allCells = row.querySelectorAll('td[role="cell"]');
        const theadRow = table.querySelector('thead[role="rowgroup"].p-datatable-thead tr[role="row"]');
        if (theadRow) {
          const headers = theadRow.querySelectorAll('th[role="cell"]');
          headers.forEach((header, index) => {
            const title = header.querySelector('.p-column-title');
            if (title?.textContent.trim() === 'Tags') {
              tagsCell = allCells[index];
            }
          });
        }
      }

      if (tagsCell) {
        const tagsText = filterAndFormatTags(tags);
        tagsCell.innerHTML = `<!----> ${tagsText}`;
        tagsCell.setAttribute('data-tags-updated', 'true');
      }
    }

    // Function to update a specific row with city data (updates Client City column only)
    function updateRowWithCity(visitId, city) {
      const table = document.querySelector('table[role="table"].p-datatable-table');
      if (!table) return;

      const tbody = table.querySelector('tbody[role="rowgroup"].p-datatable-tbody');
      if (!tbody) return;

      // Find the row by visit_link
      const allRows = tbody.querySelectorAll('tr[role="row"]');
      let row = null;

      allRows.forEach(r => {
        const visitLink = r.querySelector('a.visit_link');
        if (visitLink?.textContent.trim() === String(visitId)) {
          row = r;
        }
      });

      if (!row) return;

      // Try to find Client City cell
      let clientCityCell = row.querySelector('td[data-test="data-table-column-client-city"]');

      if (!clientCityCell) {
        clientCityCell = document.createElement('td');
        clientCityCell.setAttribute('role', 'cell');
        clientCityCell.setAttribute('data-test', 'data-table-column-client-city');
        clientCityCell.className = '';
        clientCityCell.style.minWidth = '10rem';
        row.appendChild(clientCityCell);
      }

      clientCityCell.innerHTML = `<!----> ${city || '<span>--</span>'}`;
      clientCityCell.setAttribute('data-city-updated', 'true');
    }

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    function processVisitData(data) {
      if (data?.items && Array.isArray(data.items)) {
        visitData = {};

        data.items.forEach(visit => {
          if (visit.id) {
            visitData[visit.id] = {
              tags: visit.tags || [],
              client_city: '',
              client_id: visit.client_id || visit.client?.id || null
            };
          }
        });

        // Fetch client tags and city for each visit individually
        Object.keys(visitData).forEach(visitId => {
          const clientId = visitData[visitId].client_id;
          if (clientId) {
            fetchClientTags(visitId, clientId);
          }
        });

        // Update columns with new data
        setTimeout(() => {
          if (isScheduledVisitsPage()) {
            updateVisitColumns();
            observeTableForRows();
          }
        }, 1000);
      }
    }

    XMLHttpRequest.prototype.open = function (method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      if (this._url?.includes('/api/v1/scheduler/scheduled_visits')) {
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
                      processVisitData(data);
                    } catch (err) {
                      console.error('[Vibe Extension - Visits] Error parsing blob:', err);
                    }
                  };
                  reader.readAsText(this.response);
                } else if (this.responseText) {
                  data = JSON.parse(this.responseText);
                  processVisitData(data);
                }
              } else if (this.responseType === 'json') {
                data = this.response;
                processVisitData(data);
              } else if (this.responseText) {
                data = JSON.parse(this.responseText);
                processVisitData(data);
              }
            } catch (err) {
              console.error('[Vibe Extension - Visits] Error processing XHR response:', err);
            }
          }
        });
      }

      return originalSend.apply(this, arguments);
    };

    // Function to check if URL is the scheduled visits page
    function isScheduledVisitsPage() {
      // First check if we're on AlayaCare at all
      if (!window.vibeUtils || !window.vibeUtils.isAlayaCarePage()) {
        return false;
      }

      // Check both pathname and hash for scheduled visits
      const pathname = window.location.pathname;
      const hash = window.location.hash;

      return pathname.includes('scheduling/scheduled-visits') ||
        hash.includes('scheduling/scheduled-visits');
    }

    // Function to extract visit data from existing table rows
    function extractVisitDataFromDOM() {
      const table = document.querySelector('table[role="table"].p-datatable-table');
      if (!table) return;

      const tbody = table.querySelector('tbody[role="rowgroup"].p-datatable-tbody');
      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr[role="row"]');
      let extractedCount = 0;

      rows.forEach(row => {
        const visitLink = row.querySelector('a.visit_link');
        if (!visitLink) return;

        const visitId = visitLink.textContent.trim();

        if (!visitData[visitId]) {
          visitData[visitId] = {
            tags: [],
            client_city: '',
            client_id: null
          };
          extractedCount++;

          const clientLink = row.querySelector('a[href*="/clients/"]');
          if (clientLink) {
            const href = clientLink.getAttribute('href');
            const match = href.match(/\/clients\/(\d+)/);
            if (match) {
              visitData[visitId].client_id = match[1];
            }
          }
        }
      });

      if (extractedCount > 0) {
        Object.keys(visitData).forEach(visitId => {
          const clientId = visitData[visitId].client_id;
          if (clientId) {
            fetchClientTags(visitId, clientId);
          }
        });
      }
    }

    // Function to add Tags and Client City columns to visit table
    function updateVisitColumns() {
      const table = document.querySelector('table[role="table"].p-datatable-table');
      if (!table) return;

      const thead = table.querySelector('thead[role="rowgroup"].p-datatable-thead');
      const theadRow = thead?.querySelector('tr[role="row"]') || null;
      const tbody = table.querySelector('tbody[role="rowgroup"].p-datatable-tbody');

      if (!thead || !theadRow) return;

      // Get all headers for later use
      const allHeaders = Array.from(theadRow.querySelectorAll('th[role="cell"]'));

      // Add Tags column header if it doesn't exist
      if (!theadRow.querySelector('th[data-test="column-tags"]')) {
        const tagsHeader = document.createElement('th');
        tagsHeader.setAttribute('role', 'cell');
        tagsHeader.setAttribute('data-test', 'column-tags');
        tagsHeader.className = '';
        tagsHeader.style.minWidth = '10rem';
        tagsHeader.innerHTML = '<!----> <div class="p-column-header-content"><!----> <span class="p-column-title">Tags</span> <!----> <!----> <!----> <!----></div>';

        const visitStatusHeader = allHeaders.find(th => {
          const title = th.querySelector('.p-column-title');
          return title?.textContent.trim() === 'Visit Status';
        });

        if (visitStatusHeader?.nextSibling) {
          theadRow.insertBefore(tagsHeader, visitStatusHeader.nextSibling);
        } else {
          theadRow.appendChild(tagsHeader);
        }
      }

      // Add Client City column header if it doesn't exist
      if (!theadRow.querySelector('th[data-test="column-client-city"]')) {
        const clientCityHeader = document.createElement('th');
        clientCityHeader.setAttribute('role', 'cell');
        clientCityHeader.setAttribute('data-test', 'column-client-city');
        clientCityHeader.className = '';
        clientCityHeader.style.minWidth = '10rem';
        clientCityHeader.innerHTML = '<!----> <div class="p-column-header-content"><!----> <span class="p-column-title">Client City</span> <!----> <!----> <!----> <!----></div>';

        const tagsHeader = theadRow.querySelector('th[data-test="column-tags"]');
        if (tagsHeader?.nextSibling) {
          theadRow.insertBefore(clientCityHeader, tagsHeader.nextSibling);
        } else {
          theadRow.appendChild(clientCityHeader);
        }
      }

      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr[role="row"]');

      rows.forEach(row => {
        // Get visit ID from the visit_link element
        const visitLink = row.querySelector('a.visit_link');
        const visitId = visitLink?.textContent.trim() || row.id;

        const visit = visitData[visitId];

        // Get tags from scheduled_visits data and filter them
        const tagsText = (visit?.tags?.length > 0)
          ? filterAndFormatTags(visit.tags)
          : 'No CG Preference';

        // Check if tags cell already exists
        let tagsCell = row.querySelector('td[data-test="data-table-column-tags"]');

        if (!tagsCell) {
          // Create new tags cell
          tagsCell = document.createElement('td');
          tagsCell.setAttribute('role', 'cell');
          tagsCell.setAttribute('data-test', 'data-table-column-tags');
          tagsCell.className = '';
          tagsCell.style.minWidth = '10rem';
          row.appendChild(tagsCell);

          // Update tags cell with data from scheduled_visits (initial load only)
          tagsCell.innerHTML = `<!----> ${tagsText}`;
        } else {
          // Only update if it hasn't been updated by client tags API yet
          const isUpdated = tagsCell.getAttribute('data-tags-updated');
          if (!isUpdated) {
            tagsCell.innerHTML = `<!----> ${tagsText}`;
          }
        }

        // Check if client city cell already exists
        let clientCityCell = row.querySelector('td[data-test="data-table-column-client-city"]');

        if (!clientCityCell) {
          // Create new client city cell
          clientCityCell = document.createElement('td');
          clientCityCell.setAttribute('role', 'cell');
          clientCityCell.setAttribute('data-test', 'data-table-column-client-city');
          clientCityCell.className = '';
          clientCityCell.style.minWidth = '10rem';
          row.appendChild(clientCityCell);
        }

        // Update client city cell with data if available
        const cityText = visit?.client_city || '<span>--</span>';
        clientCityCell.innerHTML = `<!----> ${cityText}`;
      });
    }

    // Store the mutation observer so we can disconnect it later
    let tableObserver = null;

    // Function to add Tags and Client City cells to a single row
    function addCellsToRow(row) {
      // Get visit ID from the visit_link element
      const visitLink = row.querySelector('a.visit_link');
      const visitId = visitLink?.textContent.trim() || row.id;

      // If we don't have visit data yet, initialize it
      if (!visitData[visitId]) {
        visitData[visitId] = {
          tags: [],
          client_city: '',
          client_id: null
        };

        // Try to extract client ID from the row
        const clientLink = row.querySelector('a[href*="/clients/"]');
        if (clientLink) {
          const href = clientLink.getAttribute('href');
          const match = href.match(/\/clients\/(\d+)/);
          if (match) {
            visitData[visitId].client_id = match[1];
            // Trigger fetching for this visit
            fetchClientTags(visitId, match[1]);
          }
        }
      }

      const visit = visitData[visitId];

      // Get tags from visitData and filter them
      const tagsText = (visit?.clientTags?.length > 0)
        ? filterAndFormatTags(visit.clientTags)
        : 'No CG Preference';

      // Check if tags cell already exists
      let tagsCell = row.querySelector('td[data-test="data-table-column-tags"]');

      if (!tagsCell) {
        // Create new tags cell
        tagsCell = document.createElement('td');
        tagsCell.setAttribute('role', 'cell');
        tagsCell.setAttribute('data-test', 'data-table-column-tags');
        tagsCell.className = '';
        tagsCell.style.minWidth = '10rem';
        row.appendChild(tagsCell);
      }

      // Update tags cell content
      tagsCell.innerHTML = `<!----> ${tagsText}`;

      // Check if client city cell already exists
      let clientCityCell = row.querySelector('td[data-test="data-table-column-client-city"]');

      if (!clientCityCell) {
        // Create new client city cell
        clientCityCell = document.createElement('td');
        clientCityCell.setAttribute('role', 'cell');
        clientCityCell.setAttribute('data-test', 'data-table-column-client-city');
        clientCityCell.className = '';
        clientCityCell.style.minWidth = '10rem';
        row.appendChild(clientCityCell);
      }

      // Update client city cell content
      const cityText = visit?.client_city || '<span>--</span>';
      clientCityCell.innerHTML = `<!----> ${cityText}`;
    }

    // Function to observe table for new rows
    function observeTableForRows() {
      const table = document.querySelector('table[role="table"].p-datatable-table');
      if (!table) return;

      const tbody = table.querySelector('tbody[role="rowgroup"].p-datatable-tbody');
      if (!tbody) return;

      tableObserver?.disconnect();

      tableObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'TR' && node.getAttribute('role') === 'row') {
                addCellsToRow(node);
              }
            });
          }
        });
      });

      tableObserver.observe(tbody, {
        childList: true,
        subtree: false
      });
    }

    // Function to check and apply columns based on URL
    function checkAndApplyColumns() {
      if (isScheduledVisitsPage()) {
        let retries = 0;
        const maxRetries = 10;
        const retryInterval = setInterval(() => {
          const table = document.querySelector('table[role="table"].p-datatable-table');
          if (table) {
            clearInterval(retryInterval);
            extractVisitDataFromDOM();
            updateVisitColumns();
            observeTableForRows();
            return;
          }

          retries++;
          if (retries >= maxRetries) {
            clearInterval(retryInterval);
          }
        }, 500);
      } else {
        tableObserver?.disconnect();
        tableObserver = null;
      }
    }

    // Export functions for use in main content script
    window.scheduledVisits = {
      checkAndApply: checkAndApplyColumns
    };

  })(); // End of IIFE

} // End of if (!window.vibeScheduledVisitsLoaded)
