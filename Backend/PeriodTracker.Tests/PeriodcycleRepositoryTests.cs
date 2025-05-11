/// <summary>
/// Unit tests for PeriodCycleRepository class using ConfigurationBuilder
/// </summary>
using Microsoft.Extensions.Configuration;
using PeriodTracker.Model.Entities;

namespace PeriodTracker.Tests.Repositories
{
    [TestClass]
    public class PeriodCycleRepositoryTests
    {
        private PeriodCycleRepository _repository;
        private UserRepository _userRepository;
        private IConfiguration _configuration;
        private int _testUserId;

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
            _repository = new PeriodCycleRepository(_configuration);
            _userRepository = new UserRepository(_configuration);

            // Create test user
            CreateTestUser();
            CleanTestData();
        }

        [TestCleanup]
        public void Cleanup()
        {
            CleanTestData();
            DeleteTestUser();
        }

        private void CreateTestUser()
        {
            var testUser = new User
            {
                Name = "Simple Cycle Test User",
                Email = "test.simple.cycle@example.com",
                Pw = "cyclepass",
                CreatedAt = DateTime.UtcNow
            };
            
            _userRepository.InsertUser(testUser);
            _testUserId = testUser.UserId;
        }

        private void DeleteTestUser()
        {
            _userRepository.DeleteUser(_testUserId);
        }

        private void CleanTestData()
        {
            using var connection = new Npgsql.NpgsqlConnection(_configuration.GetConnectionString("gretaDB"));
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = "DELETE FROM PeriodCycle WHERE user_id = @userId";
            command.Parameters.AddWithValue("@userId", _testUserId);
            command.ExecuteNonQuery();
        }

        [TestMethod]
        public void InsertCycle_ShouldCreateCycle()
        {
            // Arrange
            var testCycle = new PeriodCycle
            {
                UserId = _testUserId,
                StartDate = DateTime.Now.Date,
                EndDate = DateTime.Now.Date.AddDays(4),
                Notes = "Simple Test Cycle",
                CreatedAt = DateTime.UtcNow
            };

            // Act
            var result = _repository.InsertCycle(testCycle);

            // Assert
            Assert.IsTrue(result);
            Assert.IsTrue(testCycle.CycleId > 0);
        }

        [TestMethod]
        public void GetCyclesByUserId_ShouldReturnCycles()
        {
            // Arrange
            var cycle1 = new PeriodCycle
            {
                UserId = _testUserId,
                StartDate = DateTime.Now.Date.AddDays(-7),
                EndDate = DateTime.Now.Date.AddDays(-3),
                Notes = "Simple Cycle 1",
                CreatedAt = DateTime.UtcNow
            };
            
            _repository.InsertCycle(cycle1);

            // Act
            var userCycles = _repository.GetCyclesByUserId(_testUserId);

            // Assert
            Assert.AreEqual(1, userCycles.Count);
            Assert.AreEqual("Simple Cycle 1", userCycles[0].Notes);
        }
    }
}