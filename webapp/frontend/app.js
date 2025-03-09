document.addEventListener("DOMContentLoaded", function() {
    const loginForm = document.getElementById('login-form');
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const signupForm = document.getElementById('signup-form');
    const goToSignupButton = document.getElementById('go-to-signup');
    const backToLoginButton = document.getElementById('back-to-login');
    const faqSection = document.getElementById('faq-section');
    const aboutVidSection = document.getElementById('about-vid');
    const goToFaqButton = document.getElementById('go-to-faq');
    const backToLoginButton2 = document.getElementById('back-to-login2');
    const productSection = document.getElementById('product-section');
    const newProductForm = document.getElementById('new-product-form');
    const productErrorMessage = document.getElementById('product-error-message');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsButton = document.getElementById('settings-button');
    const closeSettingsButton = document.getElementById('close-settings');
    const signOutButton = document.getElementById('sign-out');
    const signOutPopup = document.getElementById('signout-popup');
    const cancelSignOutButton = document.getElementById('cancel-signout');
    const confirmSignOutButton = document.getElementById('confirm-signout');
    const signupErrorMessage = document.getElementById('signup-error-message');
    const products = [];  // Array to store products
    const toggleThemeButton = document.getElementById('toggle-theme');
    const errorMessage = document.getElementById('error-message');
    const countrySelect = document.getElementById("signup-country");
    const shopSelect = document.getElementById("shop-select");
    const monthlyTotalElement = document.getElementById("monthly-total-spend");
    const yearlyTotalElement = document.getElementById("yearly-total-spend");
    document.getElementById("infographics-container").style.display = "none"; // Hide chart initially

    backToLoginButton2.style.display = "none";

    async function fetchProducts(username) {
        try {
            const response = await fetch(`http://localhost:8000/user-frame/${username}`);
            if (response.ok) {
                const result = await response.json();
                return result.products; // Array of products
            } else {
                console.error('Failed to fetch products:', response.statusText);
                return [];
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            return [];
        }
    }

    function updateProductList(products) {
        const productList = document.getElementById('product-list');
        productList.innerHTML = ''; // Clear the list before adding new products

        products.forEach(product => {
            const productWidget = document.createElement('div');
            productWidget.className = 'product-widget';

            productWidget.innerHTML = `
                <div class="product-image"></div>
                <h3>${product.product_name}</h3>
                <p>ASIN: ${product.asin}</p>
                <button type="submit">Buy Now!</button>
                <button class="remove-product" data-asin="${product.asin}">Remove</button>
            `;

            productList.appendChild(productWidget);
        });

        // Attach click event listener to all "Remove" buttons
        document.querySelectorAll('.remove-product').forEach(button => {
            button.addEventListener('click', async function () {
                const asin = this.getAttribute('data-asin');
                const username = localStorage.getItem('username'); // Retrieve logged-in username

                if (username) {
                    try {
                        const response = await fetch('http://localhost:8000/user-frame/products-delete/', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ asin, username }),
                        });

                        if (response.ok) {
                            // Update the product list in the UI
                            const updatedProducts = await fetchProducts(username);
                            updateProductList(updatedProducts);
                        } else {
                            const errorData = await response.json();
                            console.error('Failed to delete product:', errorData.detail);
                        }
                    } catch (error) {
                        console.error('Error deleting product:', error);
                    }
                }
            });
        });
    }


    toggleThemeButton.addEventListener('click', async function() {
        const username = localStorage.getItem('username');
            if (!username) {
                errorMessage.textContent = "Username not found. Please log in first.";
                return;
            }

            try {
                console.log('Sending request to update theme');
                const response = await fetch('http://localhost:8000/user-frame/update-theme/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username })
                });

                console.log('Response received:', response);

                if (response.ok) {
                    const result = await response.json();
                    document.body.classList.toggle('dark-mode', Number(result.new_theme_value) === 1);
                    errorMessage.textContent = "";
                } else {
                    const errorData = await response.json();
                    productErrorMessage.textContent = errorData.detail || 'An unknown error occurred.';
                    console.error('Backend error:', errorData.detail);
                }
            } catch (error) {
                console.error('Fetch error:', error);
                productErrorMessage.textContent = `A frontend error occurred: ${error.message}`;
            }
    });

    // Populate the age dropdown with options from 18 to 100
    const signupAgeSelect = document.getElementById('signup-age');
    for (let age = 18; age <= 100; age++) {
        const birthYear = new Date().getFullYear() - age;
        const option = document.createElement('option');
        option.value = age;
        option.textContent = `${age} (${birthYear})`;
        signupAgeSelect.appendChild(option);
    }


    const ageSelect = document.getElementById('edit-age');
    for (let age = 18; age <= 100; age++) {
        const option = document.createElement('option');
        option.value = age;
        option.textContent = age;
        ageSelect.appendChild(option);
    }


    // Populate retailer dropdown
    function updateRetailerDropdown(selectedCountry) {
        const shopSelect = document.getElementById('shop-select');

        const countryRetailerMap = {
            "United Kingdom": ["Amazon UK", "Argos"],
            "UK": ["Amazon UK", "Argos"],  // Ensure consistency
            "USA": ["Amazon US", "BestBuy", "Walmart"],
        };

        shopSelect.innerHTML = ""; // Clear existing options

        let normalizedCountry = selectedCountry === "UK" ? "United Kingdom" : selectedCountry;

        if (countryRetailerMap[normalizedCountry]) {
            countryRetailerMap[normalizedCountry].forEach(shop => {
                console.log("Adding retailer:", shop); // Debugging log
                const option = document.createElement('option');
                option.value = shop;
                option.textContent = shop;
                shopSelect.appendChild(option);
            });
        } else {
            console.log("No retailers available for country:", normalizedCountry); // Debugging log
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No retailers available";
            shopSelect.appendChild(option);
        }
    }

    async function updateSubSpendCharts() {
        const username = localStorage.getItem("username");
        if (!username) return;

        console.log("updateSubSpendCharts() is being called!");

        try {
            // Fetch Monthly Subscriptions
            const monthlyResponse = await fetch(`http://localhost:8000/subscriptions/monthly/${username}`);
            const monthlyData = await monthlyResponse.json();
            const monthlySubs = monthlyData.subscriptions || [];

            // Fetch Yearly Subscriptions
            const yearlyResponse = await fetch(`http://localhost:8000/subscriptions/yearly/${username}`);
            const yearlyData = await yearlyResponse.json();
            const yearlySubs = yearlyData.subscriptions || [];

            // Process Monthly Data
            const monthlyLabels = monthlySubs.map(sub => sub.name);
            const monthlyCosts = monthlySubs.map(sub => sub.cost);
            const totalMonthlySpend = monthlyCosts.reduce((sum, cost) => sum + cost, 0);

            // Process Yearly Data
            const yearlyLabels = yearlySubs.map(sub => sub.name);
            const yearlyCosts = yearlySubs.map(sub => sub.cost);
            const totalYearlySpend = yearlyCosts.reduce((sum, cost) => sum + cost, 0);

            // Calculate total yearly costs including monthly subs
            const totalYearlyLabels = [...monthlyLabels, ...yearlyLabels];
            const totalYearlyCosts = [...monthlyCosts.map(cost => cost * 12), ...yearlyCosts];
            const overallTotalYearlySpend = totalYearlyCosts.reduce((sum, cost) => sum + cost, 0);

            // Update the total spend headers dynamically
            document.getElementById("monthly-total-spend").textContent = `Total Monthly Spend: $${totalMonthlySpend.toFixed(2)}`;
            document.getElementById("yearly-total-spend").textContent = `Total Yearly Spend: $${overallTotalYearlySpend.toFixed(2)}`;

            // Ensure the chart container is visible
            document.getElementById("infographics-container").style.display = "block";
            document.getElementById("infographics-container-2").style.display = "block";

            // Create canvas for charts
            document.getElementById("infographics-container").innerHTML = '<canvas id="subscriptionDonutChart"></canvas>';
            document.getElementById("infographics-container-2").innerHTML = '<canvas id="subscriptionDonutChart-2"></canvas>';

            const ctx1 = document.getElementById("subscriptionDonutChart").getContext("2d");
            const ctx2 = document.getElementById("subscriptionDonutChart-2").getContext("2d");

            if (!ctx1 || !ctx2) {
                console.error("🚨 Chart context is NULL!");
                return;
            }

            // Destroy old charts if they exist
            if (window.myChart1) {
                window.myChart1.destroy();
            }
            if (window.myChart2) {
                window.myChart2.destroy();
            }

            // Render Monthly Subscription Costs Donut Chart
            setTimeout(() => {
                console.log("✅ Creating new Monthly Chart.js instance...");
                window.myChart1 = new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: monthlyLabels,
                        datasets: [{
                            data: monthlyCosts,
                            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: 'Monthly Subscription Costs' },
                            tooltip: {
                                callbacks: {
                                    label: function(tooltipItem) {
                                        return tooltipItem.label + ': $' + tooltipItem.raw.toFixed(2);
                                    }
                                }
                            }
                        },
                        cutout: '60%'
                    }
                });

                console.log("✅ Creating new Yearly Chart.js instance...");
                window.myChart2 = new Chart(ctx2, {
                    type: 'doughnut',
                    data: {
                        labels: totalYearlyLabels,
                        datasets: [{
                            data: totalYearlyCosts,
                            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: true, text: 'Yearly Subscription Costs'},
                            tooltip: {
                                callbacks: {
                                    label: function(tooltipItem) {
                                        return tooltipItem.label + ': $' + tooltipItem.raw.toFixed(2);
                                    }
                                }
                            }
                        },
                        cutout: '60%'
                    }
                });
            }, 100);
        } catch (error) {
            console.error("Error fetching subscription data:", error);
        }
    }

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        localStorage.setItem('username', username);
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('http://localhost:8000/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const result = await response.json();

                // Save the country to localStorage
                localStorage.setItem('country', result.user.country);
                localStorage.setItem('age', result.user.age);
                console.log("Country after login:", localStorage.getItem('country'));

                // Update the retailer dropdown based on the country
                updateRetailerDropdown(result.user.country);

                loginSection.style.display = 'none';
                productSection.style.display = 'block';
                document.getElementById('floating-settings').style.display = 'block';

                // Set the theme based on the response from the backend
                const themeValue = Number(result.light_dark); // Ensure it is a number
                console.log('Theme value on login:', themeValue); // Debugging log
                document.body.classList.toggle('dark-mode', themeValue === 1);

                // Clear previous user’s subscription and product data
                document.getElementById('product-list').innerHTML = '';
                document.getElementById('monthly-sub-list').innerHTML = '';
                document.getElementById('yearly-sub-list').innerHTML = '';

                // Fetch and update products and subscriptions for the new user
                const products = await fetchProducts(username);
                updateProductList(products);

                await updateSubscriptionList(); // Ensure new user's subscriptions load

            } else {
                const errorData = await response.json();
                errorMessage.textContent = errorData.detail || 'Login failed';
            }
        } catch (error) {
            errorMessage.textContent = 'An error occurred during login';
            console.error('Error:', error);
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        const countrySelect = document.getElementById('country-select');
        const shopSelect = document.getElementById('shop-select');

        const countryRetailerMap = {
            "United Kingdom": ["Amazon UK", "Argos"],
            "USA": ["Amazon US", "Walmart", "Target", "BestBuy"],
        };

        // Set country and trigger dropdown update
        const savedCountry = localStorage.getItem('country') || "United Kingdom"; // Default to UK
        countrySelect.value = savedCountry;


        // Initial retailer population
        updateRetailerDropdown(savedCountry);

        // Update retailers when country changes
        countrySelect.addEventListener('change', function() {
            const selectedCountry = this.value;
            localStorage.setItem('country', selectedCountry); // Save to localStorage
            console.log("Country after login:", localStorage.getItem('country'));
            updateRetailerDropdown(selectedCountry);
        });
    });

    goToSignupButton.addEventListener('click', function() {
        loginSection.style.display = 'none';
        signupSection.style.display = 'block';
    });

    backToLoginButton.addEventListener('click', function() {
        signupSection.style.display = 'none';
        loginSection.style.display = 'block';
    });

    signupForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;
        const reenterPassword = document.getElementById('signup-reenter-password').value;
        const age = document.getElementById('signup-age').value;
        const country = document.getElementById('signup-country').value;

        // Validate username length
        if (username.length > 20) {
            signupErrorMessage.textContent = 'Username must be less than 20 characters long.';
            return;
        }

        // Validate password length and complexity
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{3,16}$/;
        if (!passwordRegex.test(password)) {
            signupErrorMessage.textContent = 'Password must be 3-16 characters long and include at least one uppercase letter, one lowercase letter, and one number.';
            return;
        }

        // Check if passwords match
        if (password !== reenterPassword) {
            signupErrorMessage.textContent = 'Passwords do not match.';
            return;
        }

        // API call to FastAPI for user registration
        try {
            const response = await fetch('http://localhost:8000/register/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                    age: parseInt(age, ),
                    status: 1, // Backend will set the status as 1
                    country: country
                })
            });

            if (response.ok) {
                alert('Account created successfully. You will be redirected to the login page.');

                // Save the country to localStorage
                localStorage.setItem('country', country);
                console.log("Country after login:", localStorage.getItem('country'));

                signupSection.style.display = 'none';
                loginSection.style.display = 'block';
                signupForm.reset();
                signupErrorMessage.textContent = '';
            } else {
                const errorData = await response.json();
                signupErrorMessage.textContent = errorData.detail || 'Sign-up failed';
            }
        } catch (error) {
            signupErrorMessage.textContent = 'An error occurred during sign-up.';
            console.error('Error:', error);
        }
    });


    // Show FAQ and About Video sections when "Go to FAQ" button is clicked
    goToFaqButton.addEventListener('click', function() {
        loginSection.style.display = 'none'; // Hide login
        signupSection.style.display = 'none'; // Hide signup
        faqSection.style.display = 'block'; // Show FAQ section
        aboutVidSection.style.display = 'block'; // Show About Video section
        backToLoginButton2.style.display = 'block';
    });

    // Navigate back to login page from FAQ page
    backToLoginButton2.addEventListener('click', function() {
        faqSection.style.display = 'none'; // Hide FAQ section
        aboutVidSection.style.display = 'none'; // Hide About Video section
        loginSection.style.display = 'block'; // Show login
        backToLoginButton2.style.display = "none"; // Hide button
    });

        newProductForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const asin = document.getElementById('new-product-asin').value;
            const name = document.getElementById('new-product-name').value;
            const username = localStorage.getItem('username'); // Fetch the logged-in user

            if (!username) {
                productErrorMessage.textContent = "Please log in to add products.";
                return;
            }

            try {
                const response = await fetch('http://localhost:8000/user-frame/products/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ asin, name, username })
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log(result.message);  // Success message

                    // Only add the product to the UI if the backend confirms success
                    addProduct(asin, name);

                    newProductForm.reset();
                    productErrorMessage.textContent = '';  // Clear error messages
                } else {
                    const errorData = await response.json();
                    productErrorMessage.textContent = errorData.detail || 'Failed to add product.';
                }
            } catch (error) {
                console.error('Error:', error);
                productErrorMessage.textContent = 'An error occurred while adding the product.';
            }
        });

        function addProduct(asin, name) {
            const productList = document.getElementById('product-list');

            const productWidget = document.createElement('div');
            productWidget.className = 'product-widget';

            // Add the product content, including the "Remove" button
            productWidget.innerHTML = `
                <div class="product-image"></div>
                <h3>${name}</h3>
                <p>ASIN: ${asin}</p>
                <button type="submit">Buy Now!</button>
                <button class="remove-product">Remove</button>
            `;

            // Append the product widget to the list
            productList.appendChild(productWidget);

            // Attach the event listener for the "Remove" button
            const removeButton = productWidget.querySelector('.remove-product');
            removeButton.addEventListener('click', async function () {
                const username = localStorage.getItem('username'); // Retrieve logged-in username

                if (username) {
                    try {
                        const response = await fetch('http://localhost:8000/user-frame/products-delete/', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ asin, username }),
                        });

                        if (response.ok) {
                            // Remove the product widget from the DOM
                            productList.removeChild(productWidget);
                        } else {
                            const errorData = await response.json();
                            console.error('Failed to delete product:', errorData.detail);
                        }
                    } catch (error) {
                        console.error('Error deleting product:', error);
                    }
                }
            });
        }

        settingsButton.addEventListener('click', function() {
            settingsPanel.classList.add('active');
        });

        closeSettingsButton.addEventListener('click', function() {
            settingsPanel.classList.remove('active');
        });

        signOutButton.addEventListener('click', function() {
            signOutPopup.style.display = 'flex';  // Show the sign-out confirmation popup
        });

        cancelSignOutButton.addEventListener('click', function() {
            signOutPopup.style.display = 'none';  // Close the popup without signing out
        });

        confirmSignOutButton.addEventListener('click', function() {
            signOutPopup.style.display = 'none';
            settingsPanel.classList.remove('active');
            productSection.style.display = 'none';
            editProfileSection.style.display = 'none';
            loginSection.style.display = 'block';
            document.getElementById('floating-settings').style.display = 'none';
            backToLoginButton2.style.display = "none";
            document.getElementById("infographics-container").style.display = "none";

            // Clear username and password fields
            const usernameField = document.getElementById('username');
            const passwordField = document.getElementById('password');

            if (usernameField && passwordField) {
                usernameField.value = '';
                passwordField.value = '';
            }

            // Reset login form
            document.getElementById('login-form').reset();

            // Clear user-related localStorage data
            localStorage.removeItem('username');
            localStorage.removeItem('country');
            localStorage.removeItem('age');

            // Clear UI elements
            document.getElementById('product-list').innerHTML = '';
            document.getElementById('monthly-sub-list').innerHTML = '';
            document.getElementById('yearly-sub-list').innerHTML = '';

            console.log("User logged out, cleared local storage and UI data.");
        });

        const shoppingListLink = document.getElementById("shopping-list-link");
        const comingSoonLink = document.getElementById("coming-soon-link");
        const shoppingListSection = document.getElementById("shopping-list");
        const comingSoonSection = document.getElementById("coming-soon-section");

        // Function to switch sections
        function switchSection(section) {
            if (section === "shopping") {
                shoppingListSection.style.display = "block";
                comingSoonSection.style.display = "none";
                shoppingListLink.classList.add("active");
                comingSoonLink.classList.remove("active");
            } else {
                shoppingListSection.style.display = "none";
                comingSoonSection.style.display = "block";
                shoppingListLink.classList.remove("active");
                comingSoonLink.classList.add("active");
            }
        }

        // Event listeners for navigation
        shoppingListLink.addEventListener("click", function (event) {
            event.preventDefault();
            switchSection("shopping");
            document.getElementById("infographics-container").style.display = "none";
        });

        comingSoonLink.addEventListener("click", async function (event) {
            event.preventDefault();
            switchSection("coming-soon");

            const infographicsContainer = document.getElementById("infographics-container");
            if (infographicsContainer) {
                infographicsContainer.style.display = "block"; // Show the chart
                await updateSubSpendCharts(); // Fetch and display the chart
            }
        });

        // Set default section
        switchSection("shopping");

        const editProfileSection = document.getElementById('edit-profile-section');
        const editProfileButton = document.getElementById('edit-profile-button');
        const backToMainButton = document.getElementById('back-to-main');

        function populateEditProfileFields() {
            const usernameField = document.getElementById('edit-username');
            const ageDropdown = document.getElementById('edit-age');

            // Get values from local storage
            const storedUsername = localStorage.getItem('username');
            const storedAge = localStorage.getItem('age');

            if (storedUsername) {
                usernameField.value = storedUsername;  // Set username (disabled field)
            }

            if (storedAge) {
                ageDropdown.value = storedAge;  // Select the stored age in dropdown
            }
        }

        // When "Edit Profile" button is clicked in settings
        editProfileButton.addEventListener('click', function() {
            settingsPanel.classList.remove('active'); // Hide settings panel
            productSection.style.display = 'none';   // Hide main products frame
            editProfileSection.style.display = 'block'; // Show edit profile frame

            populateEditProfileFields(); // Call function to populate fields
        });

        // When "Back" button in Edit Profile is clicked
        backToMainButton.addEventListener('click', function() {
            editProfileSection.style.display = 'none'; // Hide edit profile frame
            productSection.style.display = 'block';    // Show main products frame
        });

        const editProfileForm = document.getElementById("edit-profile-form");

        editProfileForm.addEventListener("submit", async function (event) {
            event.preventDefault(); // Prevent default form submission

            const username = document.getElementById("edit-username").value;
            const currentPassword = document.getElementById("edit-old-password").value;
            const newPassword = document.getElementById("edit-password").value;
            const reenterPassword = document.getElementById("edit-reenter-password").value;
            const country = document.getElementById("edit-country").value;
            const errorMessage = document.getElementById("edit-error-message");

            // Ensure current password is entered before making changes
            if (!currentPassword) {
                errorMessage.textContent = "Please enter your current password to make changes.";
                return;
            }

            // If the user wants to change their password, ensure it matches
            if (newPassword && newPassword !== reenterPassword) {
                errorMessage.textContent = "New passwords do not match.";
                return;
            }

            // Show in-backend confirmation popup
            document.getElementById("edit-confirm-popup").style.display = "flex";

            // Handle popup buttons
            document.getElementById("cancel-edit").addEventListener("click", function () {
                document.getElementById("edit-confirm-popup").style.display = "none";
            });

            document.getElementById("confirm-edit").addEventListener("click", async function () {
                document.getElementById("edit-confirm-popup").style.display = "none";

                const username = document.getElementById("edit-username").value;
                const currentPassword = document.getElementById("edit-old-password").value;
                const newPassword = document.getElementById("edit-password").value.trim();
                const country = document.getElementById("edit-country").value;
                const errorMessage = document.getElementById("edit-error-message");

                const updateData = {
                    username: username,
                    currentPassword: currentPassword,
                    newPassword: newPassword,
                    country: country
                };

                try {
                    const response = await fetch("http://localhost:8000/update-profile/", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(updateData),
                    });

                    const result = await response.json();

                    if (response.ok) {
                        alert("Profile updated successfully!");

                        // Update country in localStorage
                        localStorage.setItem('country', country);

                        // Dynamically update retailer dropdown with new country selection
                        updateRetailerDropdown(country);

                        // Hide edit profile and show products page
                        editProfileSection.style.display = 'none';
                        productSection.style.display = 'block';

                        // Refresh the product list
                        const updatedProducts = await fetchProducts(username);
                        updateProductList(updatedProducts);

                    } else {
                        errorMessage.textContent = result.detail || "An error occurred while updating the profile.";
                    }
                } catch (error) {
                    console.error("Error updating profile:", error);
                    errorMessage.textContent = "An error occurred while updating your profile.";
                }
            });
        });

        const subForm = document.getElementById("new-subscription-form");
        const monthlyList = document.getElementById("monthly-sub-list");
        const yearlyList = document.getElementById("yearly-sub-list");
        const subError = document.getElementById("sub-error-message");

        async function fetchSubscriptions(username) {
            try {
                const response = await fetch(`http://localhost:8000/subscriptions/${username}`);
                if (response.ok) {
                    const result = await response.json();
                    return result.subscriptions; // Array of subscriptions
                } else {
                    console.error("Failed to fetch subscriptions:", response.statusText);
                    return [];
                }
            } catch (error) {
                console.error("Error fetching subscriptions:", error);
                return [];
            }
        }

        async function updateSubscriptionList() {
            const username = localStorage.getItem("username");
            if (!username) return;

            console.log("Fetching subscriptions for user:", username);

            // Clear old subscription data before fetching new ones
            monthlyList.innerHTML = "";
            yearlyList.innerHTML = "";

            const subscriptions = await fetchSubscriptions(username);

            subscriptions.forEach(sub => {
                const subElement = document.createElement("div");
                subElement.className = "sub-widget";
                subElement.innerHTML = `
                    <h3>${sub.name}</h3>
                    <p>Cost: ${sub.cost.toFixed(2)}</p>
                    <p>Next Payment: ${new Date(sub.next_payment_date).toLocaleDateString()}</p>
                    <button class="remove-sub" data-name="${sub.name}">Remove</button>
                `;

                if (sub.type === "monthly") {
                    monthlyList.appendChild(subElement);
                } else {
                    yearlyList.appendChild(subElement);
                }
            });

            // Ensure charts update after subscriptions are loaded
            await updateSubSpendCharts();

            document.querySelectorAll(".remove-sub").forEach(button => {
                button.addEventListener("click", async function () {
                    const name = this.getAttribute("data-name");
                    await deleteSubscription(name, username);
                });
            });
        }

        async function deleteSubscription(name, username) {
            try {
                const response = await fetch("http://localhost:8000/subscriptions/delete", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, username })
                });

                updateSubscriptionList();

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Failed to delete subscription:", errorData.detail);
                }
            } catch (error) {
                console.error("Error deleting subscription:", error);
            }
        }

        subForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const name = document.getElementById("sub-name").value;
            const cost = parseFloat(document.getElementById("sub-cost").value);
            const date = document.getElementById("sub-date").value;
            const type = document.getElementById("sub-type").value;
            const username = localStorage.getItem("username");

            if (!name || !cost || !date || !username) {
                subError.textContent = "Please fill in all fields.";
                return;
            }

            try {
                const response = await fetch("http://localhost:8000/subscriptions/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, cost, next_payment_date: date, type, username })
                });

                if (response.ok) {
                    updateSubscriptionList();
                    updateSubSpendCharts()
                    subForm.reset();
                    subError.textContent = "";
                } else {
                    const errorData = await response.json();
                    subError.textContent = errorData.detail || "Failed to add subscription.";
                }
            } catch (error) {
                console.error("Error:", error);
                subError.textContent = "An error occurred while adding the subscription.";
            }
        });
        updateSubscriptionList();
    });