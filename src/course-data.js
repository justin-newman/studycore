// Hands the course data to app.js. The Claude artifact build inlines the same data as a JSON script tag instead.
import data from "virtual:course-data";

window.COURSE_DATA = data;
