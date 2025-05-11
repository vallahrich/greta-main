/// <summary>
/// Unit tests for UserRepository class using ConfigurationBuilder
/// </summary>
using Microsoft.Extensions.Configuration;
using PeriodTracker.Model.Entities;

namespace PeriodTracker.Tests.Repositories
{
    [TestClass]
    public class UserRepositoryTests
    {
        private UserRepository _repository;
        private IConfiguration _configuration;

        [TestInitialize]
        public void Setup()
        {
            // Create configuration using in-memory provider
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string>
                {
                    {"ConnectionStrings:gretaDB", "Host=localhost;Database=gretaDB;Username=postgres;Password="}
                })
                .Build();
            
            _configuration = config;
            _repository = new UserRepository(_configuration);

            // Clean test data before each test
            CleanTestData();
        }

        [TestCleanup]
        public void Cleanup()
        {
            // Clean test data after each test
            CleanTestData();
        }

        private void CleanTestData()
        {
            using var connection = new Npgsql.NpgsqlConnection(_configuration.GetConnectionString("gretaDB"));
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM Users WHERE email LIKE '%test.simple%@example.com'";
            command.ExecuteNonQuery();
        }

        [TestMethod]
        public void GetUserByEmail_ShouldReturnUser_WhenUserExists()
        {
            // Arrange
            var testEmail = "test.simple.user1@example.com";
            var testUser = new User
            {
                Name = "Simple Test User",
                Email = testEmail,
                Pw = "simplepass123",
                CreatedAt = DateTime.UtcNow
            };
            
            // Insert test user
            _repository.InsertUser(testUser);

            // Act
            var retrievedUser = _repository.GetUserByEmail(testEmail);

            // Assert
            Assert.IsNotNull(retrievedUser);
            Assert.AreEqual(testEmail, retrievedUser.Email);
            Assert.AreEqual("Simple Test User", retrievedUser.Name);
        }

        [TestMethod]
        public void InsertAndRetrieve_ShouldWork()
        {
            // Arrange
            var testUser = new User
            {
                Name = "Insert Retrieve Test",
                Email = "test.simple.user2@example.com",
                Pw = "insertpass",
                CreatedAt = DateTime.UtcNow
            };

            // Act
            var insertResult = _repository.InsertUser(testUser);
            var retrievedUser = _repository.GetUserById(testUser.UserId);

            // Assert
            Assert.IsTrue(insertResult);
            Assert.IsNotNull(retrievedUser);
            Assert.AreEqual(testUser.Email, retrievedUser.Email);
        }
    }
}