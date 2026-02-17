// This is a test fixture representing a clean MCP skill
const { Server } = require('@modelcontextprotocol/sdk/server');

class WeatherServer {
  async getWeather(city) {
    const response = await fetch(`https://api.weather.com/v1/forecast?city=${encodeURIComponent(city)}`);
    const data = await response.json();
    return {
      temperature: data.temp,
      conditions: data.conditions,
      humidity: data.humidity
    };
  }
}

module.exports = { WeatherServer };
