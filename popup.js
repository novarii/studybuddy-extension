// Popup script
document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const pageInfoDiv = document.getElementById('page-info');
  const sendButton = document.getElementById('send-button');
  const courseSelect = document.getElementById('course-select');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if we're on a Panopto page
  const isPanoptoPage = tab.url && (
    tab.url.includes('panopto.com') || 
    tab.url.includes('panopto.eu')
  );

  const isViewerPage = tab.url && (
    tab.url.includes('/Viewer.aspx') ||
    tab.url.includes('/Embed.aspx')
  );

  if (!isPanoptoPage) {
    pageInfoDiv.textContent = 'Not on a Panopto page';
    pageInfoDiv.classList.add('error');
    sendButton.disabled = true;
    return;
  }

  if (!isViewerPage) {
    pageInfoDiv.textContent = 'Please navigate to a Panopto video page';
    pageInfoDiv.classList.add('error');
    sendButton.disabled = true;
    return;
  }

  // Extract video info from URL
  const url = new URL(tab.url);
  const videoId = url.searchParams.get('id') || url.searchParams.get('tid');
  
  if (videoId) {
    pageInfoDiv.textContent = `Video ID: ${videoId}`;
  } else {
    pageInfoDiv.textContent = 'Could not detect video ID';
    pageInfoDiv.classList.add('error');
    sendButton.disabled = true;
    return;
  }

   // Load courses from backend to populate dropdown
  try {
    await loadCourses();
  } catch (error) {
    console.error('Error loading courses:', error);
    courseSelect.innerHTML = '<option value="">Error loading courses</option>';
    showStatus('Error loading courses: ' + error.message, 'error');
  }

  // Handle send button click
  sendButton.addEventListener('click', async () => {
    const selectedOption = courseSelect.options[courseSelect.selectedIndex];
    const courseId = courseSelect.value;
    const courseName = selectedOption ? selectedOption.textContent : '';

    if (!courseId) {
      showStatus('Please select a course', 'error');
      return;
    }

    sendButton.disabled = true;
    showStatus('Getting video link...', 'info');

    try {
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'downloadVideo',
        courseId,
        courseName
      });

      if (response.success) {
        showStatus(response.message || 'Video sent to Study Buddy! ✓', 'success');
      } else {
        showStatus('Error: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showStatus('Error: ' + error.message, 'error');
    } finally {
      setTimeout(() => {
        sendButton.disabled = false;
      }, 2000);
    }
  });

  async function loadCourses() {
    const { backendUrl } = await chrome.storage.sync.get(['backendUrl']);
    const resolvedBackendUrl = backendUrl || 'http://localhost:8000';

    if (!resolvedBackendUrl) {
      courseSelect.innerHTML = '<option value="">Backend URL not configured</option>';
      courseSelect.disabled = true;
      sendButton.disabled = true;
      return;
    }

    const response = await fetch(`${resolvedBackendUrl}/api/courses`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch courses (HTTP ${response.status})`);
    }

    const data = await response.json();
    const courses = Array.isArray(data) ? data : (data.courses || []);

    courseSelect.innerHTML = '';

    if (!Array.isArray(courses) || courses.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'No courses found. Add your first course in Study Buddy.';
      courseSelect.appendChild(emptyOption);

      courseSelect.disabled = true;
      sendButton.disabled = true;
      showStatus('No courses found. Add your first course in Study Buddy.', 'info');
      return;
    }

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a course --';
    courseSelect.appendChild(defaultOption);

    courses.forEach((course) => {
      const option = document.createElement('option');
      option.value = String(course.id ?? course.course_id ?? '');
      const code = course.code || course.course_code || '';
      const name = course.name || course.course_name || '';
      option.textContent = code && name ? `${code} - ${name}` : (name || code || 'Untitled course');
      courseSelect.appendChild(option);
    });

    courseSelect.disabled = false;
    sendButton.disabled = false;
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
});
